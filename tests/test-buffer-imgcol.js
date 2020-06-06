/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var polys = ee.FeatureCollection("users/kongdd/YarLung_10basins"),
    imgcol_d = ee.ImageCollection("projects/pml_evapotranspiration/landcover_impact/PMLV2_yearly_v015_dynamic"),
    imgcol_s = ee.ImageCollection("projects/pml_evapotranspiration/landcover_impact/PMLV2_yearly_v015_static"),
    imgcol_mete = ee.ImageCollection("projects/pml_evapotranspiration/landcover_impact/GLDAS_yearly_mete");
/***** End of imports. If edited, may not auto-convert in the playground. *****/
function rename_systemId(fs, prob) {
    prob = prob || "site";
    // reduce the export data size, only one band left
    fs = fs.select([prob]); 
    fs = fs.toList(fs.size()).map(function(f){
        f = ee.Feature(f);
        return f.set('system:index', f.get(prob));
    });
    return (ee.FeatureCollection(fs));
}

// print(polys.limit(1));
var x = polys.limit(1).select('Name', 'site').first();
// print(x.get('Name'))
var fs = rename_systemId(polys.select('Name', 'site'), 'Name');
// print(polys.propertyNames())

var pkg_buffer = require('users/kongdd/public:pkg_buffer.js');

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
    scale = ee.Number(scale).divide(5);
    
    var options_reduce = { collection: features, reducer: reducer, crs: prj, scale: scale, tileScale: 16 };
    print(options_reduce);
    
    var export_data = ImgCol.map(pkg_buffer._Buffer(options_reduce), true).flatten();
    pkg_buffer.Export_Table(export_data, save, file, folder, fileFormat);
};

var options = {
    reducers : ['mean'],  // 1th: non-buffer; 2th: buffer; Only one means no buffer
    buffer   : false,      // whether to use buffer
    list     : false, 
    folder   : '', // drive forder
    fileFormat: 'csv'      // 'csv' or 'geojson'
};
// pkg_export.spClipImgCol(imgcol_d, fs, "imgcol_d", options);
// pkg_export.spClipImgCol(imgcol_s, fs, "imgcol_s", options);
pkg_buffer.spClipImgCol(imgcol_mete, fs, "imgcol_mete_005", options);
