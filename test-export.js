// https://code.earthengine.google.com/235425776856f67349ffae2e1343f1ad
var imgcol = ee.ImageCollection("MODIS/006/MCD12Q1");
var pkg_export = require('users/kongdd/public:pkg_export2.js');
var img = imgcol.first().select(0);
var prj = pkg_export.getProj(imgcol);
var options = {
    type: "drive",
    range: [70, 15, 140, 55], //[-180, -60, 180, 90],
    cellsize: 1 / 240,
    // crsTransform : [463.312716528, 0, -20015109.354, 0, -463.312716527, 10007554.677], // prj.crsTransform;
    // scale        : 463.3127165275, // prj.scale
    crs: 'EPSG:4326', // 'SR-ORG:6974', // EPSG:4326
    folder: 'PMLV2'
};
pkg_export.ExportImg(img, "img_land_china2010", options);