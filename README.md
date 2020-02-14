# Eurovision Geographical Voting Application

![ExampleGIF](http://g.recordit.co/W6H3IpFkLh.gif)

-![Sample Gif](http://i.imgur.com/______.gif)

+<img src="/W6H3IpFkLh.gif?raw=true" width="200px">

A web application designed to visualise the geographic voting patterns in the Eurovision Song contest using the ArcGIS API for JavaScript and Chart JS graphing library. A script was written in R to preprocess data which was then published as a hosted service.

The application includes hover and tooltip capabilities, as well changing of renderer on click.

Example application:
https://codepen.io/JDawe/full/bGNPjpM

```
arcgis-js-api/4.13
```

```
Chart-js/2.7.2
```

---

## Features

- **Hover-highlight and Tooltip** functionality in ArcGIS JS 4.x
- Selection and layer renderer changes on click
- **Filter** based on vote type (all/Jury/Televotes)
- **Interactive Gauge Graph** - records breakdown of votes and can activate filter.

## Documentation

### Data preparation: **EurovisionData2019.R**

<a href="https://data.world/datagraver/eurovision-song-contest-scores-1975-2019 " target="_blank">1975-2019 score data source</a>

The data was filtered, cleaned up and pre-prepared for use.

- Repeat/erroneous data removed
- Some Country Names were changed to a more common format
- Date structure converted from long to wide.
- Cumulative vote tallies calculated for Jury, televotes and total votes.
- Country ordinal positions determined.

---

### Hover functionality:

Adapted from Esri sample: https://developers.arcgis.com/javascript/latest/sample-code/visualization-vv-color-animate/index.html

See hoverHandler function in **mapLogic.js** script:

```javascript
function hoverHandler(event) {
  // the hitTest() checks to see if any graphics in the view
  // intersect the x, y coordinates of the pointer
  view.hitTest(event).then(function getGraphics(response) {
    // highlight Logic
  });
}
```

---

### Tooltip

Adapted from Esri Sample: https://developers.arcgis.com/javascript/latest/sample-code/visualization-vv-color-animate/index.html

---

### Gauge

ChartJS Donut chart Adapted from https://codepen.io/nolang/pen/GRJKOmN

---

## Authors

- **Jonathan Dawe** - JDawe@esriuk.com

Feel free to suggest improvements/change requests.
