/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var imgcol_MODgpp = ee.ImageCollection("MODIS/006/MOD17A2H"),
    imgcol_MYDgpp = ee.ImageCollection("MODIS/006/MYD17A2H"),
    imgcol_MODet = ee.ImageCollection("MODIS/006/MOD16A2");
/***** End of imports. If edited, may not auto-convert in the playground. *****/
var pkg_main   = require('users/kongdd/public:pkg_main.js');
var pkg_export = require('users/kongdd/public:pkg_export.js');

var options = {
    type: "drive",
    range: [-180, -60, 180, 90],
    cellsize: 1 / 20,
    // crsTransform : [463.312716528, 0, -20015109.354, 0, -463.312716527, 10007554.677], // prj.crsTransform;
    // scale        : 463.3127165275, // prj.scale
    crs: 'EPSG:4326', // 'SR-ORG:6974', // EPSG:4326
    folder: 'PML-AVHRR'
};

/** ------------------------------------------------------------------------- */
export_yearly(imgcol_MODgpp, "Gpp", "MOD17A2H_006_", 2000);
// export_yearly(imgcol_MYDgpp, "Gpp", "MYD17A2H.006_", 2000);
// export_yearly(imgcol_MODet, "ET" , "MOD16A2.006_", 2000);

function export_yearly(imgcol, bands, prefix, year_begin, year_end) {
    bands      = bands || "Gpp";
    prefix     = prefix || "MOD17A2H_006_";
    year_end   = year_end || 2019;
    year_begin = year_begin || 2000;

    imgcol = imgcol.select(bands);

    // export bandnames
    var bandnames = imgcol.toBands().bandNames();
    var f = ee.FeatureCollection(ee.Feature(null, { bandname: bandnames }));
    var task_bandname = prefix.concat('BandNames');
    Export.table.toDrive(f, task_bandname, 'PML-AVHRR', task_bandname, "CSV");

    for (var year = year_begin; year <= year_end; year++) {
        var filter = ee.Filter.calendarRange(year, year, 'year');
        var imgs = imgcol.filter(filter);
        // print(imgs)  
        var task = prefix.concat("G005_").concat(year);
        // print(task)
        var img = imgs.toBands();
        if (year == year_end) print(img); // check
        pkg_export.ExportImg(img, task, options);
    }
}
