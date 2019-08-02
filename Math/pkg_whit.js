// var pkg_whit = require('users/kongdd/public:Math/pkg_whit.js');

/**
 * Whittaker smoother for ImageCollection in GEE
 * 
 * @author Dongdong Kong
 * version 0.1.5, 2019-08-03
 *
 * Copyright (c) 2019 Dongdong Kong
 * 
 * @references 
 * 1. Kong, D., Zhang, Y., Gu, X., & Wang, D. (2019). A robust method
 *     for reconstructing global MODIS EVI time series on the Google Earth Engine.
 *     *ISPRS Journal of Photogrammetry and Remote Sensing*, *155*(May), 13–24.
 *     https://doi.org/10.1016/j.isprsjprs.2019.06.014
 * 2. Zhang, Y., Kong, D., Gan, R., Chiew, F.H.S., McVicar, T.R., Zhang, Q., and 
 *     Yang, Y.. (2019) Coupled estimation of 500m and 8-day resolution global 
 *     evapotranspiration and gross primary production in 2002-2017. 
 *     Remote Sens. Environ. 222, 165-182, https://doi:10.1016/j.rse.2018.12.031
 */

var pkg_whit = {};

/** BASIC TOOLS ------------------------------------------------------------- */
/**
 * If img_con is true, img_mat will be replaced with newimg; If false, 
 * values unchanged. 
 * Note about mask. If the mask of original image and new image is 
 * different, some wield result maybe get. 
 *
 * @param  {ee.Image or ee.Image<array>} img_old 
 * @param  {ee.Image or ee.Image<array>} img_new New value
 * @param  {ee.Image or ee.Image<array>} img_con Boolean image
 * 
 * @return {[type]}         [description]
 */
pkg_whit.imageArray_replace = function(img_old, img_new, img_con){
    return img_old.expression('con * img_new + !con * b()', 
        {con:img_con, img_new:img_new} );
}

pkg_whit.check_ylu_mat = function(img_mat, ylu){
    if (ylu) {
        var ymin = ylu.select(0), 
        ymax = ylu.select(1);   
  
        img_mat = pkg_whit.imageArray_replace(img_mat, ymin, img_mat.lt(ymin));
        img_mat = pkg_whit.imageArray_replace(img_mat, ymax, img_mat.gt(ymax));
    }
    return img_mat;
}

/** 
 * constrain imgcol in the range of ylu
 *
 * @param  {[type]} imgcol [description]
 * @param  {[type]} ylu    If not specified, imgcol not processed
 * @return {[type]}        [description]
 */
pkg_whit.check_ylu = function(imgcol, ylu){
    if (ylu) {
        var ymin = ylu.select(0), 
            ymax = ylu.select(1); 
        imgcol = imgcol.map(function(img){
            return img.where(img.lt(ymin), ymin)
                .where(img.gt(ymax), ymax);
        });
    }
    return imgcol;
}

/** merge two ylu */
pkg_whit.merge_ylu = function(ylu_full, ylu){
    var ymax_full = ylu_full.select('max'), 
        ymax = ylu.select('max'), 
        ymin_full = ylu_full.select('min'),
        ymin = ylu.select('min');

    ymax = ymax.where(ymax.gt(ymax_full), ymax_full);
    ymin = ymin.where(ymin.lt(ymin_full), ymin_full);
    return ymin.addBands(ymax);
}

/** ------------------------------------------------------------------------- */
/** Weights Updating FUNCTIONS ---------------------------------------------- */
pkg_whit.wSELF = function(re, w){ return w; }

/**
 * Bisquare weights updating function
 *
 * Modified weights of each points according to residual.
 * Suggest to replaced NA values with a fixed number such as ymin.
 * Otherwise, it will introduce a large number of missing values in fitting
 * result, for lowess, moving average, whittaker smoother and Savitzky-Golay
 * filter.
 *
 * Robust weights are given by the bisquare function like lowess function
 * Reference:
 *     https://cn.mathworks.com/help/curvefit/smoothing-data.html#bq_6ys3-3.
 * re = Ypred - Yobs;      % residual
 * sc = 6 * median(abs(re));    % overall scale estimate 
 * w  = zeros(size(re)); 
 * I  = re < sc & re > 0
 * 
 * % only decrease the weight of overestimated values
 * w(I) = ( 1 - (re(I)/sc).^2 ).^2; %NAvalues weighting will be zero
 * % overestimated outliers and weights less than wmin, set to wmin
 * w(w < wmin || re > sc) = wmin;
 * 
 * @param  {ee.Image<array>} re   residuals (predicted value - original value). re < 0
 *                         means those values are overestimated. In order to 
 *                         approach upper envelope reasonably, we only decrease 
 *                         the weight of overestimated points.
 * @param  {ee.Image<array>} w    Original weights
 * @param  {Double}          wmin Minimum weight in weights updating procedure.
 * @return {ee.Image<array>} wnew New weights returned.
 */
pkg_whit.wBisquare_array = function(re, w, wmin) {
    // This wmin is different from QC module, 
    // When too much w approaches zero, it will lead to `matrixInverse` error. 
    // Genius patch! 2018-07-28
    wmin = wmin || 0.05; 
    
    var median = re.abs().arrayReduce(ee.Reducer.percentile([50]), [0]);
    var sc = median.multiply(6.0).arrayProject([0]).arrayFlatten([['sc']]);
    // Map.addLayer(re, {}, 're')
    // Map.addLayer(sc, {}, 'median')
    
    var w_new = re.expression('pow(1 - pow(b()/sc, 2), 2)', {sc:sc});
    
    var con; 
    if (w){
        // we didn't change the weights of ungrowing season.
        // con = re.expression('re > 0 & ingrowing', {re:re, ingrowing:ingrowing});
        con = re.expression('b() > 0');
        w_new = pkg_whit.imageArray_replace(w, w_new.multiply(w), con);
        // w_new = w_new.expression('(re >  0)*b()*w + (re <= 0)*w' , { re:re, w:w });
    }
    con = w_new.expression('re >= sc || b() < wmin', { re:re.abs(), sc:sc, wmin:wmin});
    w_new = pkg_whit.imageArray_replace(w_new, wmin, con);
    // w_new = w_new.expression('(b() < wmin)*wmin + (b() >= wmin)*b()', { wmin:wmin});
    // Map.addLayer(w, {}, 'inside w');
    return w_new;
}

// function wBisquare(re) {
//     re = ee.ImageCollection(re);
//     var median = re.reduce(ee.Reducer.percentile([50])); 
//     var sc = median.multiply(6.0); 
//     var w = re.map(function(res) {
//         var img = res.expression('pow(1 - pow(b()/sc, 2), 2)', {sc:sc}); 
//         return img.where(res.gte(sc), 0.0)
//             .copyProperties(res, ['system:id', 'system:index', 'system:time_start']);
//     });
//     w = w.toArray();//.toArray(1)
//     return w;
// }

/**
 * A recursive function used to get D matrix of whittaker Smoother
 * 
 * @references
 * Paul H. C. Eilers, Anal. Chem. 2003, 75, 3631-3636
 */
pkg_whit.diff_matrix = function(array, d) {
    array = ee.Array(array); //confirm variable type
    var diff = array.slice(0, 1).subtract(array.slice(0, 0, -1));
    if (d > 1) {
        diff = pkg_whit.diff_matrix(diff, d - 1);
    }
    return diff;
}

/**
 * whit_imgcol
 *
 * Whittaker Smoother for ImageCollection
 *
 * @param  {ImageCollection} ImgCol The Input time-series.
 * @param  {dictionary}      options
 * The default values:
 * - order        : 2,    // difference order
 * - wFUN         : wBisquare_array, // weigths updating function
 * - iters        : 3,    // Whittaker iterations
 * - min_A        : 0.02, // Amplitude A = ylu_max - ylu_min, points are masked if 
 *                           A < min_A.
 * - min_ValidPerc: 0.3,  // pixel valid percentage less then 30%, is not smoothed.
 * - missing      : -0.05 // Missing value in band_sm are set to missing.
 * - method = 1;  // whittaker, matrix solve option:
 *   1:matrixSolve (suggested), 2:matrixCholeskyDecomposition, 3:matrixPseudoInverse 
 * 
 * @param  {Integer}         lambda The smooth parameter, a large value mean much smoother.
 * @param  {ee.Image}        ylu (optional) Low and upper boundary
 * 
 * @return {ee.Dictionary} zs and ws
 *
 * @example
 * https://code.earthengine.google.com/5700d398ddc900c3125a36ef22090447
 */
pkg_whit.whit_imgcol = function(imgcol, options, lambda, ylu) {
    var wFUN    = options.wFUN    || pkg_whit.wBisquare_array;
    var iters   = options.iters   || 2;
    var order   = options.order   || 2;
    var missing = options.missing || -0.05;
    var min_A   = options.min_A   || 0.02;
    var min_ValidPerc = options.min_ValidPerc || 0.3;
    var method  = options.method  || 1;
    
   // update 29 July, 2018
    var n = imgcol.size();
    var con_perc = imgcol.select(0).count().divide(n).gte(min_ValidPerc);
    
    if (ylu) {
        var con_ylu  = ylu.expression('b(1)-b(0)').gt(min_A); 
        var ingrow_val = ylu.expression('(b(1)-b(0))*0.3 + b(0)');
    }
    
    var mask = con_perc; //.and(con_ylu).and(ylu.select(1).gt(0));

    imgcol = imgcol.map(function(img){
        var w  = img.select('w');
        var vi = img.select(0).unmask(missing);
        return vi.addBands(w);
    });
    
    /** parameter lambda */
    if (lambda === undefined) {
        lambda = pkg_whit.init_lambda(imgcol.select(0)); // first band
    }
    lambda = ee.Image(lambda).mask(mask);
    // lambda = lambda || 2;
    
    var ymat = imgcol.select(0).toArray(); //2d Column Image vector, .toArray(1)
    var w    = imgcol.select('w').toArray(); //2d Column Image vector, .toArray(1)
    
    var matBands = ee.List(imgcol.aggregate_array('system:time_start'))
        .map(function(x) { return ee.String('b').cat(ee.Date(x).format('YYYY_MM_dd')); });

    // var img_ymat = ymat.arrayProject([0]).arrayFlatten([matBands]);
    // var img_w    = w.arrayProject([0]).arrayFlatten([matBands]);
    // print(img_w);
    // var type   = "drive", 
    //     folder = "phenofit";
    // pkg_export.ExportImg_deg(img_ymat, 'img_ymat', range, cellsize, type, folder);
    // pkg_export.ExportImg_deg(img_w, 'img_w', range, cellsize, type, folder);
    // pkg_export.ExportImg_deg(lambda, 'lambda', range, cellsize, type, folder);
    
    var E = ee.Array.identity(n);
    var D = pkg_whit.diff_matrix(E, order);
    var D2 = ee.Image(D.transpose().matrixMultiply(D)).multiply(lambda);

    var W, C, z, re,
        imgcol_z;
    var zs    = ymat,
        ws    = w, 
        yiter = ymat, 
        w0    = w; // initial weight
    yiter = pkg_whit.check_ylu_mat(yiter, ylu);
    // Map.addLayer(lambda, vis_lambda, 'lambda');
    // Map.addLayer(w.multiply(yiter), {}, 'ymat');
   
    // pkg_main.imgRegions(lambda, points_whit, 'lambda');
    // pkg_main.imgRegions(w0, points_whit, 'w0');
    var predictor, response; // Y = Xb;
    for (var i = 1; i <= iters; i++) {
        W = ee.Image(w).matrixToDiag(); //ee.Image(E) ;//
        predictor = W.add(D2); 
        response  = w.multiply(yiter);

        if (method == 1) {
            /**solution1*/
            z = predictor.matrixSolve(response);
        } else if (method == 2) {
            /**solution2*/
            C  = predictor.matrixCholeskyDecomposition().arrayTranspose(); //already img array
            z  = C.matrixSolve(C.arrayTranspose().matrixSolve(response));
            z  = ymat.where(mask, z);
        } else if (method == 3) {
            /**solution3*/
            z = predictor.matrixPseudoInverse().matrixMultiply(response);
        }

        re = z.subtract(ymat);
        w  = wFUN(re, w0);
        
        // if (i === 1){
        //     var img_w    = w.arrayProject([0]).arrayFlatten([matBands]);
        //     pkg_export.ExportImg_deg(img_w, 'img_w_2', range, cellsize, type, folder);
        // }
        zs = zs.arrayCat(z, 1);
        ws = ws.arrayCat(w, 1);
        // zs = pkg_smooth.replace_mask(zs, ymat, 9999); // nodata:9999
        /**upper envelope*/
        var con; 
        if (ylu) {
            con = ymat.expression("b() < z && b() >= ingrow_val", 
                {z:z, w:w, ingrow_val:ingrow_val}); // & (w0 == 1)
        } else {
            con = ymat.expression("b() < z", {z:z, w:w}); // & (w0 == 1)
        }
        yiter = pkg_whit.imageArray_replace(yiter, z, con);
    }
    // Map.addLayer(mask, {}, 'mask');
    // Map.addLayer(zs, {}, 'zs');
    return { zs: ee.Image(zs), ws: ee.Image(ws) }; //, C:C
}

/** 
 * Initial parameter lambda for whittaker
 * 
 * update 20180824, the uncertainty mainly roots in `init_lambda`. 
 *
 * @note
 * This function is only validated with MOD13A1. 
 * lambda has been constrained in the range of [1e-2, 1e3]
 * 
 * Be caution about coef, when used for other time-scale. The coefs
 * should be also updated.
 *
 * @param {ee.ImageCollection} imgcol The input ee.ImageCollection should have 
 * been processed with quality control.
 */
pkg_whit.init_lambda = function(imgcol, mask_vi){
    /** Define reducer 
     *  See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce
     */
    var combine = function(reducer, prev) { return reducer.combine(prev, null, true); };
    var reducers = [ ee.Reducer.mean(), ee.Reducer.stdDev(), ee.Reducer.skew(), ee.Reducer.kurtosis()];
    var reducer  = reducers.slice(1).reduce(combine, reducers[0]);
    
    var img_coef = imgcol.reduce(reducer).select([0, 1, 2, 3], ['mean', 'sd', 'skewness', 'kurtosis']);
    
    // var formula = '0.831120 + 1.599970*b("mean") - 4.094027*b("sd") - 0.035160*b("mean")/b("sd") - 0.063533*b("skewness")';
    // try to update lambda formula; 2018-07-31
    // var formula = "0.8209 +1.5008*b('mean') -4.0286*b('sd') -0.1017*b('skewness') -0.0041*b('kurtosis')";
    // var formula = "0.8214 +1.5025*b('mean') -4.0315*b('sd') -0.1018*b('skewness')";    
    // update 20180819, 
    // cv is not significant, the coef (-0.0027) is set to zero. 
    // Lambda of 4y or 1y coefs has no significant difference.
    var formula = "0.9809 -0.00*b('mean')/b('sd') +0.0604*b('kurtosis') +0.7247*b('mean') -2.6752*b('sd') -0.3854*b('skewness')";   // 1y
    // var formula = "1.0199 -0.0074*b('mean')/b('sd') +0.0392*b('kurtosis') +0.7966*b('mean') -3.1399*b('sd') -0.3327*b('skewness')"; // 4y 

    // var formula = '0.979745736 + 0.725033847*b("mean") -2.671821865*b("sd") - 0*b("mean")/b("sd") - 0.384637294*b("skewness") + 0.060301697*b("kurtosis")';
    // var formula = "0.8055 -0.0093*b('mean')/b('sd') -0.0092*b('kurtosis') +1.4210*b('mean') -3.8267*b('sd') -0.1206*b('skewness')";
    // print("new lambda formula ...");
    // Map.addLayer(img_coef, {}, 'img_coef');
    
    var lambda = img_coef.expression(formula);
    lambda = ee.Image.constant(10.0).pow(lambda);
    if (mask_vi) {
        lambda = lambda.where(mask_vi.not(), 2);   // for no vegetation regions set lambda = 2    
    }
    lambda = lambda.where(lambda.gt(1e2), 1e2)
        .where(lambda.lt(1e-2), 1e-2);         // constain lambda range
    return lambda;
};


var DEBUG = false;
if (DEBUG){
    print('debug');
}

exports = pkg_whit;
