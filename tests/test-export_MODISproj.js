var pkg_export = require('users/kongdd/public:pkg_export.js');

/** parameters */
var range = [-180, -60, 180, 90];
var bound = ee.Geometry.Rectangle(range, 'EPSG:4326', false);

var Emiss_d8 = ee.ImageCollection('MODIS/006/MOD11A2')
    .select(['Emis_31', 'Emis_32'])
    .select([0], ['Emiss']);

var prj = pkg_export.getProj(Emiss_d8); // prj_emiss.prj

var cellsize = 1/120;
var options = {
    type: "asset",
    range: [-180, -60, 180, 89],
    // cellsize: 1 / 20,
    crsTransform: prj.crsTransform,
    // scale        : 463.3127165275, // prj.scale
    crs: 'SR-ORG:6974', // EPSG:4326
    folder: 'users/cuijian426'
};

var img = Emiss_d8.first().select(0);
var task = "test-MODISproj2";
pkg_export.ExportImg(img, task, options);
