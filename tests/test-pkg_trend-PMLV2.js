/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var imgcol_gldas = ee.ImageCollection("projects/pml_evapotranspiration/landcover_impact/GLDAS_yearly_mete"),
    imgcol_pml = ee.ImageCollection("projects/pml_evapotranspiration/landcover_impact/PMLV2_yearly_v016_dynamic");
/***** End of imports. If edited, may not auto-convert in the playground. *****/
// var pkg_join  = require('users/kongdd/public:pkg_join.js');
var pkg_trend = require('users/kongdd/public:Math/pkg_trend.js');
var pkg_export = require('users/kongdd/public:pkg_export.js');

function unify_system_index (img) {
    img = ee.Image(img);
    var date = ee.Date(img.get('system:time_start'));
    return img.set('system:id', date.format('yyyy_MM_dd'))
            .set('system:index', date.format('yyyy_MM_dd'));
}

function fix_system_index (imgcol) {
    return ee.ImageCollection(imgcol.toList(1000).map(unify_system_index));
}

function add_ET(img) {
    var ET = img.expression('b("Ec") + b("Es") + b("Ei")').rename('ET');
    return img.addBands(ET);
}

imgcol_gldas = fix_system_index(imgcol_gldas);
imgcol_pml   = fix_system_index(imgcol_pml);

var imgcol = imgcol_pml.combine(imgcol_gldas.select("Prcp"))
    .map(add_ET);

// print(imgcol);
var img_mean = imgcol.select(['ET', 'Prcp']).mean();
// var years = ee.List.sequence(2003, 2017);

// function cal_ET_prcp(img) {
//     var ratio = img.expression('b("ET)/b("Prcp")');
//     return ratio;
// }
// var imgcol = years.map(function(year) {
//     var filter = ee.Filter.calendarRange(year, year, 'year');
//     var img_prcp = imgcol_GLDAS.select('Prcp').filter(filter).first();//.resample('bicubic');
//     var img_et = imgcol_GLDAS.select([1, 2, 3]).filter(filter).first()
//         .expression('b(0) + b(1) + b(2)');
//     var ans = img_et.divide(img_prcp);
    
//     var date = ee.Date.fromYMD(year, 1, 1);
//     return ans.set('system:time_start', date.millis());
// });
// imgcol = ee.ImageCollection(imgcol)
//     .map(pkg_trend.addSeasonProb);

// // print(years)
// print(imgcol);
// // print(imgcol_GLDAS, imgcol_pml);
// var trend = pkg_trend.imgcol_trend(imgcol);
// print(trend);
// var A = 0.01;
// Map.addLayer(trend.select(1), {min:-A, max: A, palette: ['red', 'white', 'green']});


// export data
var options = {
    type: "drive",
    range: [70, 15, 140, 55], //[-180, -60, 180, 90],
    cellsize: 1 / 20,
    // crsTransform : [463.312716528, 0, -20015109.354, 0, -463.312716527, 10007554.677], // prj.crsTransform;
    // scale        : 463.3127165275, // prj.scale
    crs: 'EPSG:4326', // 'SR-ORG:6974', // EPSG:4326
    folder: 'PMLV2'
};

// pkg_export.ExportImg(trend.select([1, 2]), 'PMLV2-ET_divide_prcp_2003-2017', options);
pkg_export.ExportImg(img_mean, 'PMLV2-multiannual_average-ET_and_prcp_2003-2017', options);
