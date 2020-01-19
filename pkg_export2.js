var pkg_export = require('users/kongdd/public:pkg_export.js');

/**
 * ExportImg
 *
 * @param {ee.Image} Image: The image to export.
 * @param {String}   task : The file name of exported image
 * @param {Dictionary} options
 * - `type`         : export type, one of 'asset', 'cloud' and 'drive'
 * - `range`        : [lon_min, lat_min, lon_max, lat_max]
 * - `cellsize`     : cellsize (in the unit of degree), used to calculate dimension.
 * - `folder`       : The Folder that the export will reside in. If  export type is cloud or asset, folder need to be absolute path.
 * - `crs`          : CRS to use for the exported image.
 * - `crsTransform` : Affine transform to use for the exported image. Requires "crs" to be defined.
 * - `scale`        : (number) Resolution in meters per pixel. Defaults to 1000.
 * - `dimensions`   : Takes either a single positive integer as the maximum dimension 
 *    or "WIDTHxHEIGHT" where WIDTH and HEIGHT are each positive integers.
 * 
 * @description
 * "region" and "dimensions" and either "crs_transform" or "scale" may not be specified together.
 * If `dimension` provided, scale will be ignored.
 *
 * # Some options to clip regional data
 * 1. crs + region + crsTransform    | √
 * 2. crs + region + dimensions      | √ (resample)
 * 3. crs + region + scale           | √
 * 
 * You must Can't (20191228):
 * 1. crsTransform and dimensions can't occur in the same time, error.
 * 2. crs + region  | resampled, unknown cellsize (scale = 1000), out of control (try to fix this situation)
 * 
 * @examples
 * ExportImg(Image, task, range, cellsize, type, folder, crs, crs_trans)
 */
// // examples
// // https://code.earthengine.google.com/235425776856f67349ffae2e1343f1ad
// var imgcol = ee.ImageCollection("MODIS/006/MCD12Q1");
// var pkg_export = require('users/kongdd/public:pkg_export2.js');
// var img = imgcol.first().select(0);
// var prj = pkg_export.getProj(imgcol);
// var options = {
//     type: "drive",
//     range: [95, 30, 120, 42], //[-180, -60, 180, 90],
//     cellsize: 1 / 240,
//     // crsTransform : [463.312716528, 0, -20015109.354, 0, -463.312716527, 10007554.677], // prj.crsTransform;
//     // scale        : 463.3127165275, // prj.scale
//     crs: 'EPSG:4326', // 'SR-ORG:6974', // EPSG:4326
//     folder: 'PMLV2'
// };
// pkg_export.ExportImg(img, "img_first", options);
// pkg_export.ExportImgCol(imgcol, null, options, 'MCD12Q1_06_');
pkg_export.ExportImg = function (Image, task, options, verbose) {
    // range, cellsize, type, folder, crs, crsTransform
    var bounds; // define export region

    if (verbose === undefined) verbose = false;
    var range        = options.range || [-180, -60, 180, 90];
    var cellsize     = options.cellsize; //pkg_export.getProj(Image)['crsTransform'][0];
    var type         = options.type || 'drive';
    var folder       = options.folder || "";
    var crs          = options.crs || 'EPSG:4326'; //'SR-ORG:6974';
    var crsTransform = options.crsTransform;
    var dimensions   = options.dimensions || pkg_export.getDimensions(range, cellsize);
    var scale        = options.scale;

    function check_slash(x) {
        if (x !== "" && x.substring(x.length - 1) !== "/") x = x.concat("/");
        return x;
    }
    folder = check_slash(folder);
    bounds = ee.Geometry.Rectangle(range, 'EPSG:4326', false); //pkg_export.get_bound(range);

    if (crsTransform) {
        dimensions = undefined;
        scale = undefined;
    } else {
        // If dimensions and crsTransform don't exist in the sometime，scale works
        if (!dimensions && !scale) scale = pkg_export.getProj(Image).scale;
        // print("debug", scale, dimensions)
    }
    if (dimensions) scale = undefined;

    // var crsTransform  = [cellsize, 0, -180, 0, -cellsize, 90]; //left-top
    var params = {
        image        : Image,
        description  : task,
        crs          : crs,
        crsTransform : crsTransform,
        region       : bounds,
        dimensions   : dimensions,
        scale        : scale,
        maxPixels    : 1e13
    };

    switch (type) {
        case 'asset':
            params.assetId = folder.concat(task); //projects/pml_evapotranspiration/;
            Export.image.toAsset(params);
            break;
        case 'cloud':
            params.bucket = options.bucket;
            params.fileNamePrefix = folder.concat(task);
            params.skipEmptyTiles = true;
            Export.image.toCloudStorage(params);
            break;
        case 'drive':
            params.folder = folder;
            params.skipEmptyTiles = true;
            Export.image.toDrive(params);
            break;
    }
    if (verbose) print(options, params);
};


/**
 * Batch export GEE ImageCollection
 *
 * @param {ee.ImageCollection} ImgCol    The ImageCollection to export.
 * @param {array.<string>}     dateList  Corresponding date string list of ImgCol
 * @param {options} 
 * - `range`   : [lon_min, lat_min, lon_max, lat_max]
 * - `cellsize`: cellsize (in the unit of degree), used to calculate dimension.
 * - `type`    : export type, one of 'asset', 'cloud' and 'drive'
 * - `folder`  : The Folder that the export will reside in. If export type is cloud 
 * or asset, folder need to be absolute path.
 * - `crs`     : CRS to use for the exported image.
 * - `crsTransform`: Affine transform to use for the exported image. Requires "crs" to be defined.
 * - `dimensions`  : If specified, the calculated dimension from `cellsize` and 
 * `range` will be abandoned.
 * 
 * @param {String} prefix The prefix of the exported file name.
 */
pkg_export.ExportImgCol = function(ImgCol, dateList, options, prefix)
{    
    // Major update 
    /** 
     * If dateList was undefined, this function is low efficient.
     * ee.ImageCollection.toList() is quite slow, often lead to time out.
     */
    dateList = dateList || ee.List(ImgCol.aggregate_array('system:time_start'))
        .map(function(date){ return ee.Date(date).format('yyyy-MM-dd'); }).getInfo();

    // cellsize = cellsize || pkg_export.getProj(Image)['crsTransform'][0];
    // type   = type   || 'drive';
    // crs    = crs    || 'EPSG:4326'; // 'SR-ORG:6974';
    prefix = prefix || '';

    var n = dateList.length;
    
    for (var i = 0; i < n; i++) {
        // var img  = ee.Image(colList.get(i));
        var date = dateList[i];
        var img  = ee.Image(ImgCol.filterDate(date).first()); 
        // var task = img.get('system:id');//.getInfo();
        var task = prefix + date;
        print(task);
        pkg_export.ExportImg(img, task, options); 
    }
};

pkg_export.updateDict = function(dict_org, dict_new) {
    var key, keys = Object.keys(dict_new);
    for (var i = 0; i < keys.length; i++) {
        key = keys[i];
        dict_org[key] = dict_new[key];
    }
    // print(dict_org);
    return (dict_org);
};

pkg_export.export_shp = function(features, file, folder, fileFormat){
    folder     = folder || "";
    fileFormat = fileFormat || 'shp';
    
    features = features.map(function(f) { return f.set('index', f.get('system:index')); } );
    Export.table.toDrive({
        collection:features, 
        description:file, 
        folder:folder, 
        // fileNamePrefix, 
        fileFormat:'shp'
        // , selectors
    });
};

pkg_export.get_bound = function (range) {
    return ee.Geometry.Rectangle(range, 'EPSG:4326', false);
}

exports = pkg_export;
// print('pkg_export', pkg_export)
