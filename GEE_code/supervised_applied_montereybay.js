// written by B. Steele, ROSSyndicate, Colorado State University

//////////////////////////////////////
// Load data                        //
//////////////////////////////////////

// Load your label data into GEE
var points_20230124 = ee.FeatureCollection("projects/ee-steele-523/assets/monterey_bay_sed_labels_20230124T185649_20230124T185652_T10SEF")
  .set('date', '2023-01-24');
var points_20230218 = ee.FeatureCollection("projects/ee-steele-523/assets/monterey_bay_sed_labels_20230218T185431_20230218T190049_T10SEF")
  .set('date', '2023-02-18');
var points_20230315 = ee.FeatureCollection("projects/ee-steele-523/assets/monterey_bay_sed_labels_20230315T185139_20230315T185257_T10SEF")
  .set('date', '2023-03-15');
var points_20230325 = ee.FeatureCollection("projects/ee-steele-523/assets/monterey_bay_sed_labels_20230325T185029_20230325T185655_T10SEF")
  .set('date', '2023-03-25');
var points_20230330 = ee.FeatureCollection("projects/ee-steele-523/assets/monterey_bay_sed_labels_20230330T184951_20230330T190411_T10SEF")
  .set('date', '2023-03-30');

// merge label data
var points = ee.FeatureCollection(points_20230124)
  .merge(points_20230218)
  .merge(points_20230315)
  .merge(points_20230325)
  .merge(points_20230330)
  .randomColumn();
  
// load images
var sceneList = ['20230124T185649_20230124T185652_T10SEF',
                 '20230218T185431_20230218T190049_T10SEF',
                 '20230315T185139_20230315T185257_T10SEF',
                 '20230325T185029_20230325T185655_T10SEF',
                 '20230330T184951_20230330T190411_T10SEF'];

var mb_sen2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filter(ee.Filter.inList('system:index', sceneList));

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

mb_sen2 = mb_sen2.map(waterOnly)
mb_sen2.aside(print)
  
//////////////////////////////////////
// Train model                      //
//////////////////////////////////////

// Define the input features and output labels
var inputFeatures = ["B2", "B3", "B4", "B8"];
var outputLabel = "class";

// Remap the label values to a 0-based sequential series.
var classValues = ['cloud', 'openWater', 'lightNearShoreSediment', 'offShoreSediment'];
var remapValues = ee.List.sequence(0, 3);
points = points.remap(classValues, remapValues, outputLabel);
points = points.map(function(feature) {
  var byteValue = ee.Number(feature.get(outputLabel)).toByte();
  return feature.set('byte_property', byteValue);
});

// Split the data into training and testing sets
var split = 0.7; // percentage of data to use for training
var training = points.filter(ee.Filter.lt("random", split));
var testing = points.filter(ee.Filter.gte("random", split));
training.aside(print);
testing.aside(print);

// Train the CART model
var trainedCART = ee.Classifier.smileCart(10).train({
  features: training,
  classProperty: 'byte_property',
  inputProperties: inputFeatures
});

// Evaluate the model
var confusionMatrixCART = testing
  .classify(trainedCART)
  .errorMatrix(outputLabel, "classification");
print('CART Confusion Matrix:');
confusionMatrixCART.aside(print);

var acc_values_CART = confusionMatrixCART
  .accuracy();
print("CART Confusion Overall Accuracy: ", acc_values_CART);

//////////////////////////////////////
// Apply model to imagery           //
//////////////////////////////////////

// function to apply the CART model
var applyCART = function(image) {
  // Select the bands that correspond to the input features of the CART model
  var imageFeatures = image.select(inputFeatures);
  
  // Classify the image using the trained CART model
  var classifiedImage = imageFeatures.classify(trainedCART);
  
  return classifiedImage;
};

// apply the function to the 5 images
var mb_sen2_cart = mb_sen2.map(applyCART);


