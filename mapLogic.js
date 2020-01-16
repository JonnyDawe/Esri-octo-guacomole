require([
  //Import Esri Mapping modules
  "esri/Map",
  "esri/views/MapView",
  "esri/layers/FeatureLayer",
  "esri/Graphic",
  "dojo/dom",
  "esri/widgets/Legend",
  "esri/core/watchUtils"
], function(Map, MapView, FeatureLayer, Graphic, dom, Legend, watchUtils) {
  //--------------------------------------------------------------------------
  //
  //  Setup variables for Maps, Views and Utilities
  //
  //--------------------------------------------------------------------------

  //*** application Variables ***

  // UI HTML Elements
  const viewDivElement = document.getElementById("viewDiv"); //Map element Div
  const allButtons = document.querySelectorAll(".item"); //Radio buttons array

  let window = true; // record whether the mouse currently over the map element Div

  // Application scope
  let currentSelectedCountry; // record the currently selected country
  let countryLayerView; // stores the layer view which is created.
  let maxVoteRange = 20; // stores the current upper limit for the continuous colour renderer
  let currentFilter = "Total Votes"; // record the currently selected filter

  // Load FeatureLayer containing country data
  const layer = new FeatureLayer({
    url:
      "https://services1.arcgis.com/iKsbAcqgVYmhKSqt/arcgis/rest/services/Eurovision2019Countries/FeatureServer",
    outFields: ["*"],
    opacity: 0.7
  });

  // Create new Map
  const map = new Map({
    basemap: "gray-vector"
  });

  //Create new MapView and centre on Europe.
  const view = new MapView({
    container: "viewDiv",
    map: map,
    center: [3, 48], // longitude, latitude
    zoom: 3,
    highlightOptions: {
      color: "orange" //set highlight colour for hover.
    },

    //Restrict minimum map scale.
    constraints: {
      snapToZoom: false,
      minScale: 1000000000
    },
    resizeAlign: "top-left"
  });

  // Create new Legend
  let legend = new Legend({
    view: view,
    layerInfos: [
      {
        layer: layer,
        title: "Legend"
      }
    ]
  });

  // Initiate Tooltip for hovering.
  let tooltip = createTooltip();

  //--------------------------------------------------------------------------
  //
  //  Setup UI on application startup.
  //
  //--------------------------------------------------------------------------

  //when view has loaded - add in layer and UI in the correct sequence.

  // **** Promise chain ****
  //Load mapView
  //Create Renderer for Layer start up.
  //then add Info window, legend and layer to map.
  //then let layer graphics load.
  //then filter layerview to specific type of voting and set an intially selected country
  //then initiate UI interaction/

  view.when().then(function() {
    currentSelectedCountry = "United_Kingdom"; //start up selected country

    Promise.all([
      createRenderer(currentSelectedCountry, maxVoteRange, currentFilter)
    ])
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

        var startUpQuery = layer.createQuery();
        startUpQuery.where = "NAME_ENGL = '" + currentSelectedCountry + "'";
        startUpQuery.outFields = ["NAME_ENGL"];

        // Ensure that the the query has completed before adding startup selection graphic
        if (countryLayerView.updating) {
          var handle = countryLayerView.watch("updating", function(isUpdating) {
            if (!isUpdating) {
              // Execute the query
              countryLayerView
                .queryFeatures(startUpQuery)
                .then(function(result) {
                  addStartUpGraphic(result);
                });
              handle.remove();
            }
          });
        } else {
          // Execute the query
          countryLayerView.queryFeatures(startUpQuery).then(function(result) {
            addStartUpGraphic(result);
          });
        }

        return countryLayerView;
      })
      .then(setupActions);
  });

  //--------------------------------------------------------------------------
  //
  //  Setup Methods
  //
  //--------------------------------------------------------------------------

  function setupActions() {
    view.on("pointer-down", clickHandler); // listen for pointer down event on view
    view.on("click", clickHandler); // listen for click event on view
    view.on("pointer-move", hoverHandler); // listen for pointer movement on view

    //Add event listeners to the Radio buttons - listen for click.
    for (var i = 0; i < allButtons.length; i++) {
      allButtons[i].addEventListener("click", function(event) {
        filterByVoting(this);
      });
    }

    //Listen for the mouse entering and leaving the viewDiv element - this allows
    //the tooltip to be hidden when the mouse leaves the map.
    viewDivElement.addEventListener("mouseout", function(event) {
      window = false;
    });

    viewDivElement.addEventListener("mouseover", function(event) {
      window = true;
    });
  }

  // String formatter text removes underscore from name strings (e.g. United_Kingdom)
  function StringFormatter(string) {
    return string.replace(/_/g, " ");
  }

  // Add a startup selection to the map.
  function addStartUpGraphic(result) {
    feature = result.features[0];

    let graphic = new Graphic({
      geometry: feature.geometry,
      symbol: {
        type: "simple-fill", // autocasts as new SimpleMarkerSymbol()
        color: "blue"
      }
    });

    view.graphics.add(graphic);
  }

  //store the current target of the click event.
  let currentTarget;

  function clickHandler(event) {
    // the hitTest() checks to see if any graphics in the view
    // intersect the x, y coordinates of the clicked point
    view.hitTest(event).then(function targetFeature(response) {
      //Vector basemaps return in the hitTest results layer - a country polygon is
      //intersected by clicks only when 2 results are returned.
      if (response.results.length > 1) {
        //select the graphics from the results layer.
        const graphic = response.results.filter(function(result) {
          return result.graphic.layer === layer;
        })[0].graphic;

        let attributes = graphic.attributes; //get attributes of the country selected by a click
        currentSelectedCountry = attributes.NAME_ENGL; // set the selected country by the click
        dom.byId("info").style.visibility = "visible"; //display the info window
        dom.byId("name").innerHTML = StringFormatter(attributes.NAME_ENGL); // Add the country name to info window
        dom.byId("total-votes").innerHTML = attributes.TotalVotes + " Votes"; // Add the total votes to the info window
        dom.byId("position").innerHTML = attributes.rank; // add the position in the competetion to the info window

        //update the selected country only if a new country has been selected.
        if (currentTarget !== currentSelectedCountry) {
          currentTarget = currentSelectedCountry;
          watchUtils.whenFalseOnce(
            view,
            "updating",

            createRenderer(currentSelectedCountry, maxVoteRange, currentFilter)
          );
          // remove the current selection graphic from the map.
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

        //current country selection unchanged so return
        return;
      }
    });
  }

  let highlightSelect, currentid;
  function hoverHandler(event) {
    // the hitTest() checks to see if any graphics in the view
    // intersect the x, y coordinates of the pointer
    view.hitTest(event).then(function getGraphics(response) {
      if (response.results.length > 1) {
        //Vector basemaps return in the hitTest results layer (raster basemaps use >0)
        // - a country polygon is intersected by hover only when 2 results are returned.

        const graphic = response.results.filter(function(result) {
          return result.graphic.layer === layer;
        })[0].graphic;

        //Select some attributes from the graphics layer to work with.
        viewDivElement.style.cursor = "pointer"; // change to pointer when on countries that can be clicked.

        let attributes = graphic.attributes; //get attributes of country hovered over.
        let id = attributes.OBJECTID_1; //get object ID (used to track hover)
        let screenPoint = response.screenPoint; //cursor coordinates for tooltip
        let hoverSelection = graphic.getAttribute("NAME_ENGL"); //get country name
        let voteForSelection = graphic.getAttribute(currentSelectedCountry); //get number of votes attribute (for current selected country)

        // on hovering over a country a tooltip is always created.
        if (
          hoverSelection == currentSelectedCountry ||
          voteForSelection === undefined
          //if the country hovered over is currently selected or has undefined votes then
          //create a tooltip which contains only the country name
        ) {
          tooltip.show(screenPoint, StringFormatter(hoverSelection));
        } else {
          //Otherwise show votes in the tooltip
          tooltip.show(
            screenPoint,
            voteForSelection + " Votes from " + hoverSelection
          );
        }

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
        //if no countries hovered over then remove existing highlight
        currentid = null;
        highlightSelect.remove(); //remove highlight
        tooltip.hide(); // hide tooltip
        viewDivElement.style.cursor = "default"; //set cursor to default
      }
    });
  }

  // This function handles filtering of dataset.
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
    createRenderer(currentSelectedCountry, maxVoteRange, currentFilter); //update the rendering scales on change of filter.
  }

  // Function creates a new continuous renderer.
  // Red to Green (min to max votesS)
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
