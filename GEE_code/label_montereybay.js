// written by B. Steele, ROSSyndicate, Colorado State University
// Pixel Types. Mouse over and convert this part to geometry import 
// so that they can be selected from the map interface.
var openWater = /* color: #7ff6ff */ee.FeatureCollection([]),
    lightNearShoreSediment = /* color: #9c7238 */ee.FeatureCollection([]),
    offShoreSediment = /* color: #98ff00*/ee.FeatureCollection([]),
    cloud = /* color: #ffffff */ee.FeatureCollection([]);


// get xy data for the points
var addLatLon = function(f) {
    // add the coordinates of a feature as its properties
    var xy = f.geometry().coordinates();
    return f.set({lon: xy.get(0), lat: xy.get(1)}).setGeometry(null);
  };
  
  // merge all data together
  var mergeCollection = function() {
  
    // assign point class as property to each feature and return the merged featurecollection
    openWater = openWater.map(function(f) {
      return f.set({class: 'openWater'});
    });
  
    lightNearShoreSediment = lightNearShoreSediment.map(function(f) {
      return f.set({class: 'lightNearShoreSediment'});
    });
  
    offShoreSediment = offShoreSediment.map(function(f) {
      return f.set({class: 'offShoreSediment'});
    });
  
    cloud = cloud.map(function(f) {
      return f.set({class: 'cloud'});
    });
  
    return (openWater
    .merge(lightNearShoreSediment)
    .merge(offShoreSediment)
    .merge(cloud)
    .map(addLatLon));
  };
  
  //---- TILES ----//
  // make tile list
  var sceneList = ['COPERNICUS/S2_SR_HARMONIZED/20230124T185649_20230124T185652_T10SEF',
                  'COPERNICUS/S2_SR_HARMONIZED/20230218T185431_20230218T190049_T10SEF',
                  'COPERNICUS/S2_SR_HARMONIZED/20230315T185139_20230315T185257_T10SEF',
                  'COPERNICUS/S2_SR_HARMONIZED/20230325T185029_20230325T185655_T10SEF',
                  'COPERNICUS/S2_SR_HARMONIZED/20230330T184951_20230330T190411_T10SEF'];
  
  var shortList = ee.List(['20230124T185649_20230124T185652_T10SEF',
                  '20230218T185431_20230218T190049_T10SEF',
                  '20230315T185139_20230315T185257_T10SEF',
                  '20230325T185029_20230325T185655_T10SEF',
                  '20230330T184951_20230330T190411_T10SEF']);
  
  // Load the MODIS land cover dataset
  var modisLandCover = ee.ImageCollection('MODIS/006/MOD44W')
                        .select('water_mask')
                        .max(); // Select the maximum value to convert to binary mask
  
  // Define a function to apply the mask to each image in the collection
  var waterOnly = function(image) {
    // Create a binary mask by thresholding the MODIS land cover image
    var mask = modisLandCover.eq(1); // 1 represents land, 0 represents water
    // Apply the mask to the image and return
    return image.updateMask(mask).divide(10000);
  };
  
  // make image collection
  var mb_sen2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filter(ee.Filter.inList('system:id', sceneList))
    .map(waterOnly);
  
  mb_sen2.aside(print);
  
  // function to find current tile
  var getTile = function(index) {
    var sys_in = shortList.get(index);
    var this_tile = mb_sen2.filter(ee.Filter.eq('system:index', sys_in));
    return this_tile;
  };
  
  // intitiate i value
  var i = 0;
  
  // tc palette
  var tc = {
    min: 0.0,
    max: 0.3,
    bands: ['B4', 'B3', 'B2'],
  };
  
  
  // function on move between tiles
  var updateMapOnClick = function(i) {
    Map.clear();
    Map.add(panel1);
    var currentTile = getTile(i);
  
    Map.addLayer(currentTile, tc);
    Map.setCenter(-122.029378, 36.802226, 12);
    return currentTile;
  };
  
  //---- DEFINE UI WIDGETS ----//
  
  // 1. buttons and labels
  var layers = Map.layers();
  var label_gridId = ui.Label('', {
    padding: '4px',
    color: 'blue',
    fontWeight: 'bold'});
  var label_tile = ui.Label('', {
    padding: '4px',
    color: 'red',
    fontWeight: 'bold'});
  var button_next = ui.Button({
    label: 'Next tile',
    onClick: function() {
      i = i + 1;
      updateMapOnClick(i);
      label_tile.setValue('Current tile: ' + i);
      print(i)
    }
  });
  var button_prev = ui.Button({
    label: 'Previous tile',
    onClick: function() {
      var d = date;
      i = i - 1;
      updateMapOnClick(i);
      var date = currentTile.date().format('YYYY-MM-dd');
      label_tile.setValue('Current tile: ' + i);
    }
  });
  
  // 2. panels
  var panel1 = ui.Panel([button_prev, label_gridId, label_tile, button_next], ui.Panel.Layout.flow('horizontal'));
  panel1.style().set({
    padding: '0px',
    position: 'bottom-center'
  });
  
  // Draw UI
  var i = -1; // initiate i value
  
  Map.add(panel1);
  Map.setOptions('roadmap');
  
  //---- EXPORT ----//
  
  
  // Export data
  var merged = mergeCollection();
  
  var bandNames = ['B2', 'B3', 'B4', 'B8'];
  var scale = 10;
  
  var id = '20230330T184951_20230330T190411_T10SEF';
  var granule = mb_sen2.filter(ee.Filter.eq('system:index', id));
  
  var sen_crs = mb_sen2.first().projection().crs();
  
  // Define a function to create a point geometry from lat and lon properties
  var createPoint = function(feature) {
    var lat = feature.get('lat');
    var lon = feature.get('lon');
    return ee.Geometry.Point([lon, lat]);
  };
  
  // Map the createPoint function over the feature collection to create a new feature collection
  var pointFC = merged.map(function(feature) {
    return ee.Feature(createPoint(feature), feature.toDictionary());
  });
  
  // Print the new feature collection with point geometry
  print(pointFC);
  
  var data = granule.first().select(bandNames).reduceRegions({
    collection: pointFC,
    reducer: ee.Reducer.median(),
    scale: scale
  });
  
  var removeGeo = function(i){
    return i.setGeometry(null);
  };
  
  data.map(removeGeo).aside(print);
  data.aside(print);
  
  Export.table.toDrive({
    collection: data,
    description: 'monterey_bay_sed_labels',
    folder: '523_monterey_bay',
    fileNamePrefix: 'monterey_bay_sed_labels_'+id,
    fileFormat: 'csv'});
  