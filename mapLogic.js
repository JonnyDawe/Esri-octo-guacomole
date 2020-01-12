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
  let countryValue;
  let countryLayerView;
  const filterElement = document.getElementById("filterbar");
  const viewDivElement = document.getElementById("viewDiv");
  let window = true;

  // Define Layer (is a constant and does not change)
  const layer = new FeatureLayer({
    url:
      "https://services1.arcgis.com/iKsbAcqgVYmhKSqt/arcgis/rest/services/Eurovision2019Countries/FeatureServer",
    outFields: ["*"],
    opacity: 0.8,

    //Temporary definition expression until filter is created
    definitionExpression: "Jury_and_Televoting = 'TJ'"
  });

  //Bring in map
  //layer added during start up.
  const map = new Map({
    basemap: "gray-vector"
    // layers: [layer]
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

  //Manually define a color ramp to use.
  let colorParams = {
    layer: layer,
    valueExpression: countryValue,
    view: view,
    outlineOptimizationEnabled: true,
    colorScheme: {
      id: "test",
      colors: [
        "#dd2e3d",
        "#ff4000",
        "#ffbf00",
        "#80ff00",
        "#40ff00",
        "#00ff00"
      ],
      noDataColor: [0, 0, 0],
      colorsForClassBreaks: [],
      outline: {
        color: { r: 153, g: 153, b: 153, a: 0.25 },
        width: "0.5px"
      },
      opacity: 0.8
    }
  };

  var legend = new Legend({
    view: view,
    layerInfos: [
      {
        layer: layer,
        title: "Test"
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
    Promise.all([generateColorRenderer("$feature.United_Kingdom")])
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
    view.on("pointer-move", hoverHandler);
    view.on("pointer-down", clickHandler);
    view.on("click", clickHandler);

    filterElement.addEventListener("click", filterByVoting);

    viewDivElement.addEventListener("mouseout", function(event) {
      window = false;
    });

    viewDivElement.addEventListener("mouseover", function(event) {
      window = true;
    });
  }

  let currentTarget;
  function clickHandler(event) {
    // the hitTest() checks to see if any graphics in the view
    // intersect the x, y coordinates of the pointer
    view.hitTest(event).then(function targetFeature(response) {
      if (response.results.length > 1) {
        //if there is any results i.e. the results object returns non-zero.
        //if so then select the graphics from the layer.
        const graphic = response.results.filter(function(result) {
          return result.graphic.layer === layer;
        })[0].graphic;

        let attributes = graphic.attributes;
        let countryValue = "$feature." + attributes.NAME_ENGL;

        if (currentTarget !== countryValue) {
          currentTarget = countryValue;
          watchUtils.whenFalseOnce(
            view,
            "updating",
            generateColorRenderer(countryValue)
          );
          // graphicsLayer.removeAll();
          view.graphics.removeAll();

          graphic.symbol = {
            type: "simple-fill", // autocasts as new SimpleMarkerSymbol()
            color: "blue"
          };
          view.graphics.add(graphic);

          // graphicsLayer.add(graphic);
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
        console.log(attributes);
        let id = attributes.OBJECTID_1;
        let countryValue = "$feature." + attributes.Name_ENGL;
        var screenPoint = response.screenPoint;
        var testvalueinsp = graphic.getAttribute("NAME_ENGL");
        tooltip.show(screenPoint, "Country " + testvalueinsp);
        dom.byId("info").style.visibility = "visible";
        dom.byId("name").innerHTML = testvalueinsp;
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
        //highlightSelect.remove();
        //layer.renderer = baseRenderer
      }

      // highlight all features belonging to the same hurricane as the feature
      // returned from the hitTest
    });
  }

  /**
   * Handles the filtering
   */
  function filterByVoting(event) {
    const selectedSeason = event.target.getAttribute("data-season");
    countryLayerView.filter = {
      where: "Name_ENGL  = '" + selectedSeason + "'"
    };
  }

  /**
   * Changes the colour renderer based upon the selected country
   */

  function generateColorRenderer(Field) {
    colorParams.valueExpression = Field;

    return colorRendererCreator
      .createContinuousRenderer(colorParams)
      .then(function(response) {
        let rendererResult = response;
        layer.renderer = rendererResult.renderer;
      });
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
