// adapted from https://www.eefabook.org/ Section F3.3  //

////////////////////////////////////////////////////////////
// GENERAL TOGGLES!
////////////////////////////////////////////////////////////

// INPUT AN IMAGE (1-5)
var whichImage = 2; // will be used to select among images

// CLOUD THRESHOLD (value of 0-100)
var cloudThreshold = 100;

// NUMBER OF CLASSES
var numberOfUnsupervisedClusters = 4;

// USE SNIC? (yes or no)
var SNIC = 'no';

// specify alternative scale for SNIC clustering - minimum 50
var altScale = 100;

////////////////////////////////////////////////////////////
// SNIC TOGGLES!
////////////////////////////////////////////////////////////

// The superpixel seed location spacing, in pixels.
var SNIC_SuperPixelSize = 16;
// Larger values cause clusters to be more compact (square/hexagonal). 
// Setting this to 0 disables spatial distance weighting.
var SNIC_Compactness = 0;
// Connectivity. Either 4 or 8. 
var SNIC_Connectivity = 4;
// Either 'square' or 'hex'.
var SNIC_SeedShape = 'square';

////////////////////////////////////////////////////////////
// 0. Functions for image processing
////////////////////////////////////////////////////////////

function maskS2clouds(image) {
  var qa = image.select('QA60');

  // Bits 10 and 11 are clouds and cirrus, respectively.
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;

  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
      .and(qa.bitwiseAnd(cirrusBitMask).eq(0));

  // Extract the MSK_CLDPRB band
  var cloudProb = image.select('MSK_CLDPRB');
  
  // Threshold the pixel values to create a binary mask
  var cloudMask = cloudProb.lte(cloudThreshold);
  
  // Apply the masks to the image and return
  return image.updateMask(mask).divide(10000).updateMask(cloudMask);
}

// Load the MODIS land cover dataset
var modisLandCover = ee.ImageCollection('MODIS/006/MOD44W')
                      .select('water_mask')
                      .max(); // Select the maximum value to convert to binary mask

// Define a function to apply the mask to each image in the collection
var waterOnly = function(image) {
  // Create a binary mask by thresholding the MODIS land cover image
  var mask = modisLandCover.eq(1); // 1 represents land, 0 represents water
  // Apply the mask to the image and return
  return image.updateMask(mask);
};


////////////////////////////////////////////////////////////
// 1. Functions for kmeans
////////////////////////////////////////////////////////////

// This function does unsupervised clustering classification 
// input = any image. All bands will be used for clustering.
// numberOfUnsupervisedClusters = tunable parameter for how 
//        many clusters to create.

var afn_Kmeans = function(input, 
                          numberOfUnsupervisedClusters,
                          defaultStudyArea, 
                          processScale) {
    // Make a new sample set on the input. Here the sample set is 
    // randomly selected spatially. 
    var training = input.sample({
        region: defaultStudyArea,
        scale: processScale,
        numPixels: 10000
    });
    var cluster = ee.Clusterer.wekaKMeans(numberOfUnsupervisedClusters)
        .train(training);
    // Now apply that clusterer to the raw image that was also passed in. 
    var toExport = input.cluster(cluster);
    // The first item is the unsupervised classification. Name the band.
    var clusterUnsup = toExport.select(0).rename('unsupervisedClass');
    return clusterUnsup;
};

// 1.1 Simple normalization by maxes function.
var afn_normalize_by_maxes = function(img, bandMaxes) {
    return img.divide(bandMaxes);
};

// 1.2 Simple add 'mean' to Band Name function, indicating that the band is no longer the raw values
var afn_addMeanToBandName = (function(i) {
    return i + '_mean';
});

// 1.3 Seed Creation and SNIC segmentation Function
var afn_SNIC = function(maskedImage, 
      SuperPixelSize, 
      Compactness,
      Connectivity, 
      NeighborhoodSize, 
      SeedShape) {
    var theSeeds = ee.Algorithms.Image.Segmentation.seedGrid(
        SuperPixelSize, SeedShape);
    var snic2 = ee.Algorithms.Image.Segmentation.SNIC({
        image: maskedImage,
        size: SuperPixelSize,
        compactness: Compactness,
        connectivity: Connectivity,
        neighborhoodSize: NeighborhoodSize,
        seeds: theSeeds
    });
    var theStack = snic2.addBands(theSeeds);
    return (theStack);
};

////////////////////////////////////////////////////////////
// 2. Parameters to function calls
////////////////////////////////////////////////////////////
 
// 2.2. Visualization and Saving parameters
var centerObjectYN = true;

// 2.4 Parameters that can stay unchanged
// Tile neighborhood size (to avoid tile boundary artifacts). Defaults to 2 * size.
var SNIC_NeighborhoodSize = 2 * SNIC_SuperPixelSize;

//////////////////////////////////////////////////////////
// 3. Statements
//////////////////////////////////////////////////////////

// Set parameters
if (SNIC === 'no') {
  var processScale = 10;
} else { 
  var processScale = altScale;
}
var threeBandsToDraw = ['B4', 'B3', 'B2'];
var bandsToUse = ['B4', 'B3', 'B2'];
var bandMaxes = [1, 1, 1];
var drawMin = 0;
var drawMax = 0.3;


// 3.1  Selecting Image to Classify 
if (whichImage == 1) {
    var whichCollection = 'COPERNICUS/S2_SR_HARMONIZED';
    var ImageToUseID = '20230124T185649_20230124T185652_T10SEF';
    var originalImage = ee.Image(whichCollection + '/' + ImageToUseID);
    var maskedImage = maskS2clouds(originalImage);
    maskedImage = waterOnly(maskedImage);
    var defaultStudyArea = originalImage.geometry();
    var zoomArea = defaultStudyArea.centroid();
    print(ImageToUseID, originalImage);
    } else if (whichImage == 2) {
    var whichCollection = 'COPERNICUS/S2_SR_HARMONIZED';
    var ImageToUseID = '20230218T185431_20230218T190049_T10SEF';
    var originalImage = ee.Image(whichCollection + '/' + ImageToUseID);
    var maskedImage = maskS2clouds(originalImage);
    maskedImage = waterOnly(maskedImage);
    var defaultStudyArea = originalImage.geometry();
    var zoomArea = defaultStudyArea.centroid();
    } else if (whichImage == 3) {
    var whichCollection = 'COPERNICUS/S2_SR_HARMONIZED';
    var ImageToUseID = '20230315T185139_20230315T185257_T10SEF';
    var originalImage = ee.Image(whichCollection + '/' + ImageToUseID);
    var maskedImage = maskS2clouds(originalImage);
    maskedImage = waterOnly(maskedImage);
    var defaultStudyArea = originalImage.geometry();
    var zoomArea = defaultStudyArea.centroid();
    } else if (whichImage == 4) {
    var whichCollection = 'COPERNICUS/S2_SR_HARMONIZED';
    var ImageToUseID = '20230325T185029_20230325T185655_T10SEF';
    var originalImage = ee.Image(whichCollection + '/' + ImageToUseID);
    var maskedImage = maskS2clouds(originalImage);
    maskedImage = waterOnly(maskedImage);
    var defaultStudyArea = originalImage.geometry();
    var zoomArea = defaultStudyArea.centroid();
    } else if (whichImage == 5) {
    var whichCollection = 'COPERNICUS/S2_SR_HARMONIZED';
    var ImageToUseID = '20230330T184951_20230330T190411_T10SEF';
    var originalImage = ee.Image(whichCollection + '/' + ImageToUseID);
    var maskedImage = maskS2clouds(originalImage);
    maskedImage = waterOnly(maskedImage);
    var defaultStudyArea = originalImage.geometry();
    var zoomArea = defaultStudyArea.centroid();
    } 

Map.addLayer(maskedImage.select(threeBandsToDraw), {
  min: 0,
  max: 0.2
}, '3.1 ' + ImageToUseID, true, 1);

////////////////////////////////////////////////////////////
// 4. Image Pre-processing 
////////////////////////////////////////////////////////////
var clippedImageSelectedBands = maskedImage
    .select(bandsToUse);
var ImageToUse = afn_normalize_by_maxes(clippedImageSelectedBands, bandMaxes);

////////////////////////////////////////////////////////////
// 5. SNIC Clustering
////////////////////////////////////////////////////////////

// This function returns a multi-banded image that has had SNIC
// applied to it. It automatically determine the new names 
// of the bands that will be returned from the segmentation.
var SNIC_MultiBandedResults = afn_SNIC(
    ImageToUse,
    SNIC_SuperPixelSize,
    SNIC_Compactness,
    SNIC_Connectivity,
    SNIC_NeighborhoodSize,
    SNIC_SeedShape
);

var SNIC_MultiBandedResults = SNIC_MultiBandedResults
    .reproject('EPSG:3857', null, processScale);

if (SNIC === 'yes') {
Map.addLayer(SNIC_MultiBandedResults.select('clusters')
    .randomVisualizer(), {}, '5.3 SNIC Segment Clusters', true, 1);
}

if (SNIC === 'yes') {
  var theSeeds = SNIC_MultiBandedResults.select('seeds');
  Map.addLayer(theSeeds, {
      palette: 'red'
  }, '5.4 Seed points of clusters', true, 1);
}

var bandMeansToDraw = threeBandsToDraw.map(afn_addMeanToBandName);

var clusterMeans = SNIC_MultiBandedResults.select(bandMeansToDraw);

if (SNIC === 'yes') {
  Map.addLayer(clusterMeans, {
      min: drawMin,
      max: drawMax
  }, '5.7 Image repainted by segments', true, 0);
}

////////////////////////////////////////////////////////////
// 6. Execute Classifications
////////////////////////////////////////////////////////////

// 6.1 Per Pixel Unsupervised Classification for Comparison
var PerPixelUnsupervised = afn_Kmeans(ImageToUse,
    numberOfUnsupervisedClusters, 
    defaultStudyArea,
    processScale);
Map.addLayer(PerPixelUnsupervised.select('unsupervisedClass')
    .randomVisualizer(), {}, '6.1 Per-Pixel Unsupervised', true, 0
    );

// 6.2 SNIC Unsupervised Classification for Comparison
var bandMeansNames = bandsToUse.map(afn_addMeanToBandName);

var meanSegments = SNIC_MultiBandedResults.select(bandMeansNames);
var SegmentUnsupervised = afn_Kmeans(meanSegments,
    numberOfUnsupervisedClusters, defaultStudyArea,
    processScale);

if (SNIC === 'yes') {
  Map.addLayer(SegmentUnsupervised.randomVisualizer(), {},
      '6.3 SNIC Clusters Unsupervised', true, 0);
}

////////////////////////////////////////////////////////////
// 7. Zoom if requested
////////////////////////////////////////////////////////////
if (centerObjectYN === true) {
    Map.centerObject(zoomArea, 10);
}


