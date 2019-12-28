/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var pkg_export = {};
/***** End of imports. If edited, may not auto-convert in the playground. *****/
// var pkg_export = require('users/kongdd/public:pkg_export.js');

/**
 * Clip image data of points buffer
 *
 * map function handle for BufferPoints, return a function of img
 *
 * @param  {[type]} points   [description]
 * @param  {[type]} distance [description]
 * @param  {[type]} reducer  [description]
 * @param  {[type]} scale    [description]
 * @param  {[type]} list     [description]
 * @param  {dict} options    other options for reduceRegions, e.g. crs, scale
 * 
 * @return {[type]}          [description]
 * 
 * @examples
 * var export_data = ImgCol.map(mh_BufferPoints(points, 250, reducer,
 * 250));
 */
pkg_export._Buffer = function(options) {
    var reducer = options.reducer;
    var list = typeof reducer === 'string' || reducer.getInfo().type !== 'Reducer.toCollection';
    
    // Only Reducer.toCollection is different, which has a features in property
    if (list){
        // ee.Reducer.toList() result contains geometry, need to remove it.
        // features' band properties have already could distinguish each other.
        return function(img){
            return img.reduceRegions(options)
                .map(function(f){ 
                    return ee.Feature(null).copyProperties(f)
                        .set('date', ee.Date(img.get('system:time_start')).format('yyyy-MM-dd'));
                });
        };
    }else{
        return function(img){
            var data = img.reduceRegions(options)
                .map(function(f){ return f.get('features'); })
                .flatten(); 
            // `ee.Reducer.toCollection` has no feature geometry, and cliped 
            // data are in FeatureCollection.
            return data;
        };
    }
};


/**
 * Clip ImageCollection by points or polygons
 *
 * @param  {ee.ImageCollection}   ImgCol   The ImageCollection you want to clip
 * @param  {ee.FeatureCollection} features The FeatureCollection used to clip
 * `ImgCol`, can be point or polygon FeatureCollection.
 * @param  {Integer} distance If `distance` > 0, a buffer with the ridius of
 * `distance` will be applied to `features`.
 * @param  {ee.Reducer} reducer e.g. ee.Reducer.toList(), ee.Reducer.mean(), ee.Reducer.first(), ...
 * @param  {Integer} scale    [description]
 * @param  {Boolean} list     [description]
 * @param  {Boolean} save     [description]
 * @param  {String}  file     [description]
 * @param  {Boolean} folder   [description]
 * @return {NULL}          [description]
 */
pkg_export.clipImgCol = function(ImgCol, features, distance, reducer, file, options){
    var folder     = options.folder     || "";     // drive forder
    var fileFormat = options.fileFormat || "csv";  // 'csv' or 'geojson'
    var save =  (options.save === undefined) ? true : options.save;

    distance   = distance   || 0;
    reducer    = reducer    || "first";

    if (distance > 0) features = features.map(function(f) { return f.buffer(distance);});

    var image = ee.Image(ImgCol.first()).select(0);
    var prj   = image.projection(), 
        scale = prj.nominalScale();
    var options_reduce = { collection: features, reducer: reducer, crs: prj, scale: scale, tileScale: 16 };

    var export_data = ImgCol.map(pkg_export._Buffer(options_reduce), true).flatten();
    pkg_export.Export_Table(export_data, save, file, folder, fileFormat);
};


/**
 * [spClipImgCol description]
 *
 * @param  {ImageCollection}   imgcol     The ImageCollection to export.
 * @param  {FeatureCollection} points     The FeatureCollection to clip \code{imgcol}
 * @param  {Double} scale      scale only used to generate buffer distance. 
 * `reduceRegions` use image.projection().nominalScale() as scale.
 * @param  {String} name       [description]
 * @param  {ee.Reducer} reducers 2*1 reducer, the first one is for no buffer 
 * situation; the second is for buffer. If reduces length is 1, then default
 * reducer for buffer is 'toList' when \code{list} = true. 
 * If list = true, while reducer also is `toList`, error will be occured.
 * @param  {boolean} list       If list = false, any null value in feature will 
 * lead to the feature being ignored. If list = true, value in csv will be 
 * like that `[0.8]`.
 * 
 * @param  {[type]} buffer     [description]
 * @param  {[type]} folder     [description]
 * @param  {[type]} fileFormat [description]
 * @return {[type]}            [description]
 */
// Example:
// var options = {
//     reducers : ['first'],  // 1th: non-buffer; 2th: buffer; Only one means no buffer
//     buffer   : true,      // whether to use buffer
//     list     : false, 
//     folder   : '', // drive forder
//     fileFormat: 'csv'      // 'csv' or 'geojson'
// };
// pkg_export.spClipImgCol(imgcol, points, "imgcol_prefix", options)
pkg_export.spClipImgCol = function(ImgCol, Features, file_prefix, options){
    file_prefix = file_prefix || "";
    var reducers   = options.reducers  || ['toList']; // 1th: non-buffer; 2th: buffer
    var buffer     = options.buffer    || false;      // whether to use buffer
    var list       = options.list      || false;

    var image  = ee.Image(ImgCol.first()), 
        prj    = image.select(0).projection();
    // scale is used to decide buffer `dist` and filename
    var scale  = options.scale || prj.nominalScale().getInfo(); 
    
    var dists  = buffer ? [0, 1, 2] : [0];
    var file, dist, reducer, reducer_buffer,
        reducer_nobuffer = reducers[0];

    // reduce for buffer
    if (reducers.length > 1){
        reducer_buffer = reducers[1];
    } else {
        reducer_buffer  = list ? ee.Reducer.toList() : ee.Reducer.toCollection(ee.Image(ImgCol.first()).bandNames());             
    }
  
    ImgCol = ee.ImageCollection(ImgCol);
    for(var i = 0; i < dists.length; i++){
        dist = scale*dists[i];
        // If distance > 0, buffer will be applied to `features`
        reducer = dist > 0 ? reducer_buffer : reducer_nobuffer ;  
     
        file = file_prefix.concat('_').concat(Math.floor(dist)).concat('m_buffer');//fluxsites_
        pkg_export.clipImgCol(ImgCol, Features, dist, reducer, file, options); //geojson
    }  
};


/**
 * Export_table
 *
 * @param  {ImageCollection}   ImgCol the ImageCollection data you want to
 * export.
 * @param  {FeatureCollection} points points used to clip ImgCol
 * @param  {boolean}           save   whether save or not
 * @param  {String}            file   filename
 * @return {FeatureCollection} If save = false, will return FeatureCollection.
 * Otherwise, none will be return. 
 */
pkg_export.Export_Table = function(export_data, save, file, folder, fileFormat) {
    save       = save       || false;
    folder     = folder     || "";
    fileFormat = fileFormat || "GeoJSON";

    // export params
    var params = {
        collection  : export_data, //.flatten(),
        description : file,
        folder      : folder,
        fileFormat  : fileFormat //GeoJSON, CSV
    };

    // If save, then export to drive, else print in the console
    if (save) {
        Export.table.toDrive(params);
    } else {
        print(file, export_data);
    }
};


pkg_export.clip = function(ImgCol, poly){
  return ImgCol.map(function(img){
      return img.clip(poly.geometry());
  });
};


/**
 * Get exported image dimensions
 *
 * @param {array.<number>}     range     [lon_min, lat_min, lon_max, lat_max]
 * @param {double} cellsize  cellsize (in the unit of degree), used to calculate 
 * dimension.
 * 
 * @return {String} WIDTHxHEIGHT
 *
 * @example
 * pkg_export.getDimensions(range, cellsize)
 */
pkg_export.getDimensions = function (range, cellsize) {
    if (!range || !cellsize) return undefined;

    var step = cellsize; // degrees
    var sizeX = (range[2] - range[0]) / cellsize;
    var sizeY = (range[3] - range[1]) / cellsize;
    sizeX = Math.round(sizeX);
    sizeY = Math.round(sizeY);

    var dimensions = sizeX.toString() + 'x' + sizeY.toString(); //[sizeX, ]
    return dimensions;
};


/** Get projection info of ee.Image or ee.ImageCollection */
pkg_export.getProj = function(img){
    img = ee.ImageCollection(img).first();
    var prj = img.select(0).projection();
    var prj_dict = prj.getInfo();
    
    return {
        prj          : prj, 
        scale        : ee.Number(prj.nominalScale()).getInfo(),
        crs          : prj_dict.crs,
        crsTransform : prj_dict.transform
    };
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


pkg_export.range_global = [-180, -60, 180, 90]; // [long_min, lat_min, long_max, lat_max]
pkg_export.range_TP     = [73, 25, 105, 40];    // Tibetan Plateau

exports = pkg_export;
// print('pkg_export', pkg_export)
