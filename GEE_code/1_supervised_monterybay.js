// written by B. Steele, ROSSyndicate, Colorado State University

// Load your data into GEE
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

// merge data
var points = ee.FeatureCollection(points_20230124)
  .merge(points_20230218)
  .merge(points_20230315)
  .merge(points_20230325)
  .merge(points_20230330)
  .randomColumn();

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

/*
// Train the RF model
var trainedRF = ee.Classifier.smileRandomForest(10).train({
  features: training,
  classProperty: 'byte_property',
  inputProperties: inputFeatures
});

// Evaluate the model
var confusionMatrixRF = testing
  .classify(trainedRF)
  .errorMatrix(outputLabel, "classification");
print('RF Confusion Matrix:');
confusionMatrixRF.aside(print);

var acc_values_RF = confusionMatrixRF
  .accuracy();
print("RF Confusion Overall Accuracy: ", acc_values_RF);
*/


