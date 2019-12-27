var pkg_export = require('users/kongdd/public:pkg_export.js');

/**
 * ExportImg
 *
 * @param {ee.Image} Image     The image to export.
 * @param {String} task      The file name of exported image
 * @param {array.<number>}     range     [lon_min, lat_min, lon_max, lat_max]
 * @param {double} cellsize  cellsize (in the unit of degree), used to calculate 
 * dimension.
 * @param {String} type      export type, i.e. 'asset', 'cloud' and 'drive'
 * @param {String} folder    The Folder that the export will reside in. If 
 * export type is cloud or asset, folder need to be absolute path.
 * @param {String} crs       CRS to use for the exported image.
 * @param {String} crsTransform  Affine transform to use for the exported image. 
 * Requires "crs" to be defined.
 * 
 * @example
 * ExportImg(Image, task, range, cellsize, type, folder, crs, crs_trans)
 */
pkg_export.ExportImg = function(Image, task, options){
    // range, cellsize, type, folder, crs, crsTransform
    var bounds; // define export region

    var range    = options.range    || [-180, -60, 180, 90];
    var cellsize = options.cellsize || pkg_export.getProj(Image)['crsTransform'][0];
    var type     = options.type     || 'drive';
    var folder   = options.folder   || "";
    var crs      = options.crs      || 'EPSG:4326'; //'SR-ORG:6974';
    var crsTransform = options.crsTransform;

    if (crsTransform === undefined){
        bounds = ee.Geometry.Rectangle(range, 'EPSG:4326', false); //[xmin, ymin, xmax, ymax]
    }
    var dimensions = options.dimensions || pkg_export.getDimensions(range, cellsize);
    
    // var crsTransform  = [cellsize, 0, -180, 0, -cellsize, 90]; //left-top
    var params = {
        image        : Image,
        description  : task,
        crs          : crs,
        crsTransform : crsTransform,
        region       : bounds,
        dimensions   : dimensions,
        maxPixels    : 1e13
    };

    switch(type){
        case 'asset':
            params.assetId = folder.concat('/').concat(task); //projects/pml_evapotranspiration/;
            Export.image.toAsset(params);  
            break;
    
        case 'cloud':
            params.bucket         = "kongdd";
            params.fileNamePrefix = folder.concat('/').concat(task);
            params.skipEmptyTiles = true;
            Export.image.toCloudStorage(params);
            break;
        
        case 'drive':
            params.folder         = folder;
            params.skipEmptyTiles = true;
            Export.image.toDrive(params);  
            break;
    }
    // print(params);
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

exports = pkg_export;
// print('pkg_export', pkg_export)
