// http://fettblog.eu/gulp-recipes-part-1/
// https://github.com/chalk/chalk
var gulp = require('gulp'),
    es = require('event-stream');
    fs = require('fs'),
    del = require('del'),
    gutil = require('gulp-util'),
    csswring = require('csswring'),
    vinylPaths = require('vinyl-paths'),
    browserSync = require('browser-sync'),
    runSequence = require('run-sequence'),
    stylish = require('jshint-stylish-ex');

var plugins = require('gulp-load-plugins')();

var failOnError = true;

var basePaths = {
    src: 'src',
    dest: './dist',
    bower: 'bower_components/'
};

var paths = {
    images: {
        src: basePaths.src + '/images',
        dest: basePaths.dest + '/images'
    },
    scripts: {
        src: basePaths.src + '/js',
        dest: basePaths.dest + '/js'
    },
    sass: {
        src: basePaths.src + '/sass',
        dest: basePaths.dest + '/css'
    },
    styles: {
        src: basePaths.src + '/css',
        dest: basePaths.dest + '/css'
    },    
    sprite: {
        src: basePaths.src + '/sprite/*'
    },
    fonts: {
        src: basePaths.src + '/fonts',
        dest: basePaths.dest + '/fonts'
    },
    html: {
      src: basePaths.src,
      dest: basePaths
    } 
};


gulp.task('init', function() {
  var isDev = false;
  if (isDev) {    
    failOnError = false;
  }
});

gulp.task('styles', function() {
  var processors = [
        plugins.autoprefixer({browsers: ['last 2 version', 'safari 5', 'ie 8', 'ie 9', 'opera 12.1', 'ios 6', 'android 4']}),
        csswring({
          preserveHacks: true,
          removeAllComments: true
        })
    ];
  function getMessages(file) {
    if (file.csslint.success) {
      // Don't show something if success
      return false;
    }

    var errors = file.csslint.results.map(function (data) {
      if (data.error) {
        return "(Line " + data.error.line + ') ' + data.error.message;
      }
    }).join("\n");
    return (file.relative + " (" + file.csslint.errorCount + " errors)\n" + errors);
  }

  gulp.src([paths.styles.src+'/**/*.css'])
    .pipe(plugins.csslint())
    .pipe(plugins.csslint.reporter())
    .pipe(plugins.if(failOnError, plugins.csslint.reporter('fail')))
    .pipe(plugins.notify(getMessages))    
    .pipe(gulp.dest(paths.styles.dest))
    .pipe(plugins.sourcemaps.init({loadMaps: true}))
    .pipe(plugins.rename({suffix: '.min'}))
    .pipe(plugins.postcss([csswring]))
    .pipe(plugins.sourcemaps.write('./', {includeContent: false, sourceRoot: '../css'}))
    .pipe(gulp.dest(paths.styles.dest))
    .pipe(plugins.size({title: 'styles', showFiles:true}));

});

gulp.task('scripts:clean', function() {
  try {
    var file = paths.scripts.src+'/all.js';
    var f = fs.statSync(file);  
    if (f.isFile()) {
      return del([file]);  
    } else {
      return gulp.noop();
    }
  }
  catch(err) {
    gutil.log(gutil.colors.red('Warning: ' + err));
  }
});

// Work around for bug in uglify which causes sourcemaps to incorrectly output sourcemap comment
gulp.task('scripts:concat', function() {
    function getMessage(file) {
      if (file.jshint.success && file.jscs.success) {
        // Don't show something if success
        return false;
      }

      var errors = ""
      var count = 0
      if (file.jshint.results) {
        errors = file.jshint.results.map(function (data) {
          if (data.error) {
            return "(" + data.error.line + ':' + data.error.character + ') ' + data.error.reason;
          }
        }).join("\n");
        count = file.jshint.results.length;
      }      

      if (file.jscs.errors) {
        errors += file.jscs.errors.getErrorList().map(function (data) {
          return "(" + data.line + ':' + data.column + ') ' + data.message;
        }).join("\n");
        count += file.jscs.errorCount;
      }
      return (file.relative + " (" + count + " errors)\n" + errors);
    }

    var stream = gulp.src(['!'+ paths.scripts.src + '/libs/**/*.*', '!'+ paths.scripts.src+'/all.js', paths.scripts.src+'/**/*.js'])
                      .pipe(plugins.plumber())                    // Prevent lint/check style errors to not fail pipeline here
                      .pipe(plugins.jshint('.jshintrc'))          // Lint   
                      .pipe(plugins.jscs())                       // Code style check
                      .pipe(plugins.plumber.stop())
                      .pipe(plugins.notify(getMessage))           // Notifier
                      .pipe(plugins.jshint.reporter(stylish))     // Report lint errors to console
                      .pipe(plugins.jscs.reporter())              // Report style check errors to console
                      .pipe(plugins.if(failOnError, plugins.jscs.reporter('fail')))   // Fail if required on style errors
                      .pipe(plugins.if(failOnError, plugins.jshint.reporter('fail'))) // Fail if required on lint errors
                      .pipe(gulp.dest(paths.scripts.dest))             // Copy files to dest
                      .pipe(plugins.concat('all.js'))             // Concat all JS into All
                      .pipe(gulp.dest(paths.scripts.src))              // Write all to both dest and src (for min task)
                      .pipe(gulp.dest(paths.scripts.dest))
                      .pipe(plugins.size({title: 'scripts concat', showFiles:true}))
                      .on('error', plugins.notify.onError(function (error) {
                        return error.message;
                      }));
    return stream;
});

gulp.task('scripts:min', function() {
  var stream = gulp.src(['!'+ paths.scripts.src + '/libs/**/*.*', paths.scripts.src+'/**/*.js'])
    .pipe(plugins.plumber({errorHandler:failOnError}))
    .pipe(plugins.sourcemaps.init({loadMaps: true}))    
    .pipe(plugins.uglify().on('error', gutil.log))
    .pipe(plugins.rename({suffix: '.min'}))
    .pipe(plugins.sourcemaps.write('./',{includeContent: false, sourceRoot: '../js'}))
    .pipe(plugins.plumber.stop())
    .pipe(gulp.dest(paths.scripts.dest))
    .pipe(plugins.size({title: 'scripts min', showFiles:true}));
    return stream;
});

gulp.task('scripts:copy', function() {
  var stream = gulp.src([paths.scripts.src + '/libs/**/*.*'])
    .pipe(plugins.sourcemaps.init({loadMaps: true}))
    .pipe(gulp.dest(paths.scripts.dest+'/libs'));
    return stream;
});

gulp.task('scripts', function(cb){
  runSequence('scripts:clean', 'scripts:concat', 'scripts:min', 'scripts:copy', 'scripts:clean', cb)  
});

gulp.task('fonts', function() {
  return gulp.src([paths.fonts.src+'/**/*.*'])
    .pipe(gulp.dest(paths.fonts.dest));
});

// Optimizes the images that exists
gulp.task('images', function () {
  return gulp.src(paths.images.src+'/**')
    .pipe(plugins.changed(paths.images.dest))
    .pipe(plugins.imagemin({
      // Lossless conversion to progressive JPGs
      progressive: true,
      // Interlace GIFs for progressive rendering
      interlaced: true
    }))
    .pipe(gulp.dest(paths.images.dest))
    .pipe(plugins.size({title: 'images'}));
});

gulp.task('html', function() {
  gulp.src(paths.html.src+'/**/*.html')
    .pipe(gulp.dest(paths.html.dest+'/'));
});

gulp.task('browser-sync', ['styles', 'scripts'], function() {
  browserSync({
    server: {
      baseDir: basePaths.dest + "/",
      injectChanges: true // this is new
    }
  });
});

gulp.task('deploy', function() {
  return gulp.src(basePaths.dest+'/**/*')
             .pipe(plugins.ghPages())
             .pipe(plugins.notify("Deployed to github pages"));
});

gulp.task('watch', function() {
  function swallowError (error) {

    // If you want details of the error in the console
    console.log(gutil.colors.red(error.toString()));

    this.emit('end');
  }  

  function changeEvent(evt) {
      gutil.log('File', gutil.colors.cyan(evt.path.replace(new RegExp('/.*(?=/' + basePaths.src+ ')/'), '')), 'was', gutil.colors.magenta(evt.type));
  }

  // Watch .html files
  gulp.watch(paths.html.src+'/**/*.html', ['html', browserSync.reload]).on('change', function(evt) {
        changeEvent(evt);
    });
  gulp.watch(paths.html.dest+"/*.html").on('change', browserSync.reload);
  // Watch .css files
  gulp.watch(paths.html.src+'/css/**/*.css', ['styles', browserSync.reload])
      .on('error', swallowError)
      .on('change', function(evt) {
          changeEvent(evt);
      });
  // Watch .js files
  gulp.watch(paths.scripts.src+'/**/*.js', ['scripts', browserSync.reload])
      .on('error', swallowError)
      .on('change', function(evt) {
          changeEvent(evt);
      });
  // Watch image files
  gulp.watch(paths.images.src+'/**/*', ['images', browserSync.reload])
      .on('change', function(evt) {
          changeEvent(evt);
      });
  gulp.watch(paths.images.dest+'/**/*', ['change', browserSync.reload])
      .on('change', function(evt) {
          changeEvent(evt);
      });  
});

gulp.task('clean', ['scripts:clean'], function() {
    return del([paths.styles.dest, paths.scripts.dest, paths.images.dest, paths.fonts.dest, paths.html.dest+"/**/*.html"]);
});

gulp.task('serve', function() { 
    gulp.start('init', 'styles', 'scripts', 'fonts', 'images', 'html', 'browser-sync', 'watch');    
});

gulp.task('default', function() { 
    gulp.start('styles', 'scripts', 'fonts', 'images', 'html');    
});
