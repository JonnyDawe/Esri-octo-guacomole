require([
  //Main Map Modules
  "esri/Map",
  "esri/views/MapView",
  "esri/layers/FeatureLayer",

  "esri/renderers/smartMapping/creators/color",
  "dojo/dom",
  "esri/widgets/Legend",
  "esri/tasks/support/AlgorithmicColorRamp",
  "esri/Color",
  "esri/core/watchUtils"
], function(
  Map,
  MapView,
  FeatureLayer,
  colorRendererCreator,
  dom,
  Legend,
  AlgorithmicColorRamp,
  Color,
  watchUtils
) {
  //--------------------------------------------------------------------------
  //
  //  Setup variables for Maps, Views and Utilities
  //
  //--------------------------------------------------------------------------

  //define variables used throughout

  let allButtons = document.querySelectorAll(".item");
  let countryValue;
  let countryLayerView;
  let maxVoteRange = 20;
  let currentFilter = "Total Votes";
  const filterElement = document.querySelector(".FilterBar");
  const viewDivElement = document.getElementById("viewDiv");
  let window = true;

  // Define Layer (is a constant and does not change)
  const layer = new FeatureLayer({
    url:
      "https://services1.arcgis.com/iKsbAcqgVYmhKSqt/arcgis/rest/services/Eurovision2019Countries/FeatureServer",
    outFields: ["*"],
    opacity: 0.8

    //Temporary definition expression until filter is created
    //definitionExpression: "Jury_and_Televoting = 'TJ'"
  });

  //Bring in map
  //layer added during start up.
  const map = new Map({
    basemap: "gray-vector"
  });

  //create the map view and place in viewDiv - centre on France
  const view = new MapView({
    container: "viewDiv",
    map: map,
    center: [1, 48], // longitude, latitude
    zoom: 5,
    highlightOptions: {
      color: "orange"
    },

    //currently a zoom constraint set - maybe change.
    constraints: {
      snapToZoom: false,
      minScale: 100000000
    },
    resizeAlign: "top-left"
  });

  var legend = new Legend({
    view: view,
    layerInfos: [
      {
        layer: layer,
        title: "Legend"
      }
    ]
  });

  //--------------------------------------------------------------------------
  //
  //  Setup UI on application startup.
  //
  //--------------------------------------------------------------------------
  let tooltip = createTooltip();
  //when view has loaded then create the renderer for the layer.
  //add newly rendered layer to the map
  //then when layer is added check that layer view is loaded.
  //set the layer view as a stored variable to be used in setupActions.

  view.when().then(function() {
    Promise.all([createRenderer("United_Kingdom", 20, currentFilter)])
      .then(function() {
        view.ui.add("info", "manual");
        view.ui.add(legend, "bottom-right");
        map.add(layer);
        return layer.when();
      })
      .then(function(layer) {
        return view.whenLayerView(layer);
      })
      .then(function(layerView) {
        countryLayerView = layerView;
        countryLayerView.filter = {
          where: "Jury_and_Televoting  = 'TJ'"
        };
        return countryLayerView;
      })
      .then(setupActions);
  });

  //Define event listeners on UI

  //--------------------------------------------------------------------------
  //
  //  Setup Methods
  //
  //--------------------------------------------------------------------------

  function setupActions() {
    view.on("pointer-down", clickHandler);
    view.on("click", clickHandler);
    view.on("pointer-move", hoverHandler);

    for (var i = 0; i < allButtons.length; i++) {
      allButtons[i].addEventListener("click", function(event) {
        filterByVoting(this);
      });
    }

    viewDivElement.addEventListener("mouseout", function(event) {
      window = false;
    });

    viewDivElement.addEventListener("mouseover", function(event) {
      window = true;
    });
  }

  //store the current target of the click event.
  let currentTarget;
  let currentSelectedCountry;

  function clickHandler(event) {
    // the hitTest() checks to see if any graphics in the view
    // intersect the x, y coordinates of the pointer
    view.hitTest(event).then(function targetFeature(response) {
      if (response.results.length > 1) {
        // >1 as vector basemap counts as a result unlike raster!
        //if there is any results i.e. the results object returns non-zero.
        //if so then select the graphics from the layer.
        const graphic = response.results.filter(function(result) {
          return result.graphic.layer === layer;
        })[0].graphic;

        //get attributes of the country selected by a click
        let attributes = graphic.attributes;
        let countryValue = "$feature." + attributes.NAME_ENGL;
        currentSelectedCountry = attributes.NAME_ENGL;
        dom.byId("info").style.visibility = "visible";
        dom.byId("name").innerHTML = attributes.NAME_ENGL;
        dom.byId("total-votes").innerHTML = attributes.TotalVotes;
        dom.byId("position").innerHTML = attributes.rank;

        //update the selected country only if a new country has been selected.
        if (currentTarget !== countryValue) {
          currentTarget = countryValue;
          watchUtils.whenFalseOnce(
            view,
            "updating",

            createRenderer(currentSelectedCountry, maxVoteRange, currentFilter)
          );
          // remove the current secltion graphic from the map.
          view.graphics.removeAll();

          //**** this could be change to improve the selection appearance.
          // Also do I want to consider what happens if a country did not compete....
          graphic.symbol = {
            type: "simple-fill", // autocasts as new SimpleMarkerSymbol()
            color: "blue"
          };

          // add the new graphic as a simple fill.
          view.graphics.add(graphic);
          tooltip.hide();
        }
        return;
      }
    });
  }

  let highlightSelect, currentid;
  function hoverHandler(event) {
    // the hitTest() checks to see if any graphics in the view
    // intersect the x, y coordinates of the pointer
    view.hitTest(event).then(function getGraphics(response) {
      /* 
        This is the getGraphics function which is called using the promise above. Note that when the
        function is called the input is the response which comes from the view.hitTest!!!
  
        When resolved, returns an object containing the graphics (if present) that intersect the given screen coordinates.
        */

      if (response.results.length > 1) {
        //if there is any results i.e. the results object returns non-zero.
        //if so then select the graphics from the layer.
        const graphic = response.results.filter(function(result) {
          return result.graphic.layer === layer;
        })[0].graphic;

        //Select some attributes from the graphics layer to work with.

        let attributes = graphic.attributes;
        let id = attributes.OBJECTID_1;
        let screenPoint = response.screenPoint;
        let hoverSelection = graphic.getAttribute("NAME_ENGL");
        let voteForSelection = graphic.getAttribute(currentSelectedCountry);

        if (
          hoverSelection == currentSelectedCountry ||
          voteForSelection === undefined
        ) {
          tooltip.show(screenPoint, hoverSelection);
        } else {
          tooltip.show(
            screenPoint,
            voteForSelection + " Votes from " + hoverSelection
          );
        }

        // dom.byId("category").innerHTML = "Category ";
        // dom.byId("wind").innerHTML = " kts";

        //If Id which is returned is not already selected then remove current highlight

        if (highlightSelect && currentid !== id) {
          highlightSelect.remove();
          highlightSelect = null;
        }

        //If the selection makes it through the above check and is still highlighted then
        //return as the item is unchanged!

        if (highlightSelect) {
          return;
        }

        /* If the through to here then this is a new feature which needs to be highlighted! so do so.
         */

        highlightSelect = countryLayerView.highlight(id);
        currentid = id;
      } else {
        currentid = null;
        highlightSelect.remove();
        tooltip.hide();
      }

      // highlight all features belonging to the same hurricane as the feature
      // returned from the hitTest
    });
  }

  /**
   * Handles the filtering
   */
  function filterByVoting(eventTarget) {
    const selectedVoteType = eventTarget.getAttribute("voteType");
    countryLayerView.filter = {
      where: "Jury_and_Televoting  = '" + selectedVoteType + "'"
    };

    switch (selectedVoteType) {
      case "TJ":
        maxVoteRange = 20;
        currentFilter = "Total Votes";
        break;

      case "J":
        maxVoteRange = 12;
        currentFilter = "Jury Votes";
        break;

      case "T":
        maxVoteRange = 12;
        currentFilter = "Televotes";
        break;
    }
    createRenderer(currentSelectedCountry, maxVoteRange, currentFilter);
  }

  /**
   * Changes the colour renderer based upon the selected country
   */

  function createRenderer(countrySelected, maxColorRange, legendTitle) {
    layer.renderer = {
      type: "simple",
      symbol: {
        type: "simple-fill",
        color: "rgb(0, 0, 0)",
        outline: {
          // autocasts as new SimpleLineSymbol()
          color: "black",
          width: 1,
          opacity: 0.8
        }
      },
      visualVariables: [
        {
          type: "color",
          field: countrySelected,
          legendOptions: {
            title: legendTitle + " From Each Country"
          },
          stops: [
            {
              value: maxColorRange,
              color: "#1a9850",
              label: maxColorRange.toString()
            },
            {
              value: maxColorRange / 2,
              color: "#ffffbf",
              label: (maxColorRange / 2).toString()
            },
            {
              value: 0,
              color: "#d7191c",
              label: "0"
            }
          ]
        }
      ]
    };
  }

  /**
   * Creates a tooltip to display the votes for a country
   */
  function createTooltip() {
    var tooltip = document.createElement("div");
    var style = tooltip.style;

    tooltip.setAttribute("role", "tooltip");
    tooltip.setAttribute("id", "tTip");
    tooltip.classList.add("tooltip");

    var textElement = document.createElement("div");
    textElement.classList.add("esri-widget");
    tooltip.appendChild(textElement);

    view.container.appendChild(tooltip);

    var x = 0;
    var y = 0;
    var targetX = 0;
    var targetY = 0;
    var visible = false;

    // move the tooltip progressively
    function move() {
      x += (targetX - x) * 0.1;
      y += (targetY - y) * 0.1;

      if (Math.abs(targetX - x) < 1 && Math.abs(targetY - y) < 1) {
        x = targetX;
        y = targetY;
      } else {
        requestAnimationFrame(move);
      }

      style.transform =
        "translate3d(" + Math.round(x) + "px," + Math.round(y) + "px, 0)";
    }

    return {
      show: function(point, text) {
        if (window) {
          if (!visible) {
            x = point.x;
            y = point.y;
          }

          targetX = point.x;
          targetY = point.y;
          style.opacity = 1;
          visible = true;
          textElement.innerHTML = text;

          move();
        } else {
          style.opacity = 0;
          visible = false;
        }
      },

      hide: function() {
        style.opacity = 0;
        visible = false;
      }
    };
  }
});
