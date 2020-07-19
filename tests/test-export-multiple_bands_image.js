/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var imgcol_gpp = ee.ImageCollection("MODIS/006/MOD17A2H"),
    imgcol_LAI = ee.ImageCollection("MODIS/006/MOD15A2H");
/***** End of imports. If edited, may not auto-convert in the playground. *****/
// https://code.earthengine.google.com/235425776856f67349ffae2e1343f1ad
var imgcol = ee.ImageCollection("MODIS/006/MCD15A3H");
imgcol = imgcol;

imgcol = imgcol_gpp.select(0);
print(imgcol.size());

var pkg_export = require('users/kongdd/public:pkg_export.js');
var img = imgcol.first().select(0);
var prj = pkg_export.getProj(imgcol);
// c(25, 40, 73, 105)
// [70, 15, 140, 55]
var options = {
    type: "drive",
    range: [-180, -60, 180, 90],
    // range: [73, 25, 105, 40], //[-180, -60, 180, 90],
    cellsize: 1 / 240,
    ncol:3,
    verbose:true,
    // crsTransform : [463.312716528, 0, -20015109.354, 0, -463.312716527, 10007554.677], // prj.crsTransform;
    // scale        : 463.3127165275, // prj.scale
    crs: 'EPSG:4326', // 'SR-ORG:6974', // EPSG:4326
    folder: 'MODIS'
};

// 1. multiple bands img
// var task = "MOD17A2H_GPP_010deg_TP_";

// 1. MOD15A2H
var imgcol = ee.ImageCollection("MODIS/006/MOD15A2H")
    .filterDate('2000-01-01', '2019-12-31')
    .select(['Lai_500m']);
    //FparExtra_QC
var task = "MOD15A2H-raw-LAI_010deg_TP";


for(var year = 2016; year <= 2019; year ++) {
  if (year == 2018) next();
  
  print(year)
  // imgcol = imgcol.filter(ee.Filter.calendarRange(year, year, 'year'));
  // var task = "MOD15A2H-raw-LAI_240deg_global".concat('_').concat(year);
  
  // var img = imgcol.toBands();
  // pkg_export.ExportImg2(img, task, options);
}


// print(imgcol.limit(3), 'MOD15A2H');
// 2. MCD15A2H
// var imgcol = ee.ImageCollection("MODIS/006/MCD15A3H")
//     .filterDate('2000-01-01', '2019-12-31').select('Lai');
// print(imgcol.limit(3), 'MCD15A2H');
// var task = "MCD15A2H-raw-LAI_010deg_TP";

// var task = "smoothed_LAI_010deg_TP_";
// var imgcol = require('users/kongdd/gee_PML:src/mosaic_LAI.js').smoothed;

// export bandnames
// var bandnames = img.bandNames();
// var f = ee.FeatureCollection(ee.Feature(null, {bandname: bandnames}));
// var task_bandname = task.concat('names');
// Export.table.toDrive(f, task_bandname, 'PMLV2', task_bandname, "CSV");

// 2. imgcol
// pkg_export.ExportImgCol(imgcol, null, options, "MOD17A2H_GPP_010deg_TP_");
