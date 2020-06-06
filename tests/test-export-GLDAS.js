/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var imgcol = ee.ImageCollection("NASA/GLDAS/V021/NOAH/G025/T3H");
/***** End of imports. If edited, may not auto-convert in the playground. *****/
var pkg_export = require('users/kongdd/public:pkg_export.js');
var pkg_trend = require('users/kongdd/public:Math/pkg_trend.js');


function gldas_inputs_d8(date_begin, date_end, dailyImg_iters){
    date_end = ee.Date(date_end).advance(1, 'day'); // for filterDate
    var gldas_raw = ee.ImageCollection("NASA/GLDAS/V021/NOAH/G025/T3H")
        .filterDate(date_begin, date_end)
        .map(pkg_trend.add_dn_date);
    print(gldas_raw.limit(3));
    
    // var gldas_accu = pkg_trend.aggregate_prop(gldas_raw.select(['Rainf_f_tavg']), 'd8', 'sum')
    //     .map(function(img){ return img.multiply(3600 * 3).copyProperties(img, ['system:id']);})
    //     .select([0], ['Prcp']);
    var gldas_inst = pkg_trend.aggregate_prop(
        gldas_raw.select(['Qair_f_inst', 'LWdown_f_tavg', 'SWdown_f_tavg', 'Psurf_f_inst', 'Wind_f_inst', 'Rainf_f_tavg', 'Tair_f_inst']), 'system:id', 'mean')  
        .map(function(img){
            var Q_Ra = img.select([0, 1, 2]);           // ['q'], Specific humidity, kg/kg
                                                        // ['Rln', 'Rs'] , W/m2/s 
            var Pa = img.select([3]).divide(1000);      // ['Pa'] cnovert to kPa
            var U2 = img.expression('U10*4.87/log(67.8*10-5.42)', {U10:img.select([4])}); //gldas wind height is 10m
            var Tavg = img.select('Tair_f_inst');
            var prcp = img.select([5]).multiply(86400); // ['Prcp'], kg/m2/s to mm
            return Q_Ra.addBands([Pa, U2, prcp, Tavg]);
        }).select([0, 1, 2, 3, 4, 5, 6], ['q', 'Rln', 'Rs', 'Pa', 'U2', 'Prcp', 'Tavg']);
    
    // var gldas = gldas_Tair.combine(gldas_inst); 
    return gldas_inst;
}

var date_begin = '2020-01-01';
var date_end = '2020-04-30';
var imgcol2 = gldas_inputs_d8(date_begin, date_end, null).select(['Prcp', 'Tavg', 'q', 'Pa']);
print(imgcol2);

// export parameters
var options = {
    type: "drive",
    range: [68, 8, 98, 38], //[-180, -60, 180, 90],
    cellsize: 1 / 4,
    // crsTransform : [463.312716528, 0, -20015109.354, 0, -463.312716527, 10007554.677], // prj.crsTransform;
    // scale        : 463.3127165275, // prj.scale
    crs: 'EPSG:4326', // 'SR-ORG:6974', // EPSG:4326
    folder: 'mete-forcing'
};

var task = "mete-forcing_india2020";
var img = imgcol2.toBands(); // big image
pkg_export.ExportImg(img, task, options);

// export bandnames
var bandnames = img.bandNames();
var f = ee.FeatureCollection(ee.Feature(null, {bandname: bandnames}));
var task_bandname = task.concat('-bandnames');
Export.table.toDrive(f, task_bandname, 'mete-forcing', task_bandname, "CSV");
