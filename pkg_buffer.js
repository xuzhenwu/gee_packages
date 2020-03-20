/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var pkg_buffer = {};
/***** End of imports. If edited, may not auto-convert in the playground. *****/
// var pkg_buffer = require('users/kongdd/public:pkg_buffer.js');

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
pkg_buffer._Buffer = function(options) {
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
pkg_buffer.clipImgCol = function(ImgCol, features, distance, reducer, file, options){
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

    var export_data = ImgCol.map(pkg_buffer._Buffer(options_reduce), true).flatten();
    pkg_buffer.Export_Table(export_data, save, file, folder, fileFormat);
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
// pkg_buffer.spClipImgCol(imgcol, points, "imgcol_prefix", options)
pkg_buffer.spClipImgCol = function(ImgCol, Features, file_prefix, options){
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
        pkg_buffer.clipImgCol(ImgCol, Features, dist, reducer, file, options); //geojson
    }  
};

pkg_buffer.clip = function(ImgCol, poly){
  return ImgCol.map(function(img){
      return img.clip(poly.geometry());
  });
};

exports = pkg_buffer;
// print('pkg_buffer', pkg_buffer)
