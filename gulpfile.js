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
    srcDir = "src",
    destDir = "./dist";

gulp.task('init', function() {
  failOnError = false;
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

  gulp.src([srcDir+'/css/**/*.css'])
    .pipe(plugins.csslint())
    .pipe(plugins.csslint.reporter())
    .pipe(plugins.if(failOnError, plugins.csslint.reporter('fail')))
    .pipe(plugins.notify(getMessages))    
    .pipe(gulp.dest(destDir+'/css'))
    .pipe(plugins.sourcemaps.init({loadMaps: true}))
    .pipe(plugins.rename({suffix: '.min'}))
    .pipe(plugins.postcss([csswring]))
    .pipe(plugins.sourcemaps.write('./', {includeContent: false, sourceRoot: '../css'}))
    .pipe(gulp.dest(destDir+'/css'));

});

gulp.task('scripts:clean', function() {
  try {
    var file = srcDir+'/js/all.js';
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

    var stream = gulp.src(['!'+ srcDir + '/js/libs/**/*.*', '!'+ srcDir+'/all.js', srcDir+'/js/**/*.js'])
                      .pipe(plugins.plumber())                    // Prevent lint/check style errors to not fail pipeline here
                      .pipe(plugins.jshint('.jshintrc'))          // Lint   
                      .pipe(plugins.jscs())                       // Code style check
                      .pipe(plugins.plumber.stop())
                      .pipe(plugins.notify(getMessage))           // Notifier
                      .pipe(plugins.jshint.reporter(stylish))     // Report lint errors to console
                      .pipe(plugins.jscs.reporter())              // Report style check errors to console
                      .pipe(plugins.if(failOnError, plugins.jscs.reporter('fail')))   // Fail if required on style errors
                      .pipe(plugins.if(failOnError, plugins.jshint.reporter('fail'))) // Fail if required on lint errors
                      .pipe(gulp.dest(destDir+'/js'))             // Copy files to dest
                      .pipe(plugins.concat('all.js'))             // Concat all JS into All
                      .pipe(gulp.dest(srcDir+'/js'))              // Write all to both dest and src (for min task)
                      .pipe(gulp.dest(destDir+'/js'))
                      .on('error', plugins.notify.onError(function (error) {
                        return error.message;
                      }));
    return stream;
});

gulp.task('scripts:min', function() {
  var stream = gulp.src(['!'+ srcDir + '/js/libs/**/*.*', srcDir+'/js/**/*.js'])
    .pipe(plugins.plumber({errorHandler:failOnError}))
    .pipe(plugins.sourcemaps.init({loadMaps: true}))    
    .pipe(plugins.uglify().on('error', gutil.log))
    .pipe(plugins.rename({suffix: '.min'}))
    .pipe(plugins.sourcemaps.write('./',{includeContent: false, sourceRoot: '../js'}))
    .pipe(plugins.plumber.stop())
    .pipe(gulp.dest(destDir+'/js'));
    return stream;
});

gulp.task('scripts:copy', function() {
  var stream = gulp.src([srcDir + '/js/libs/**/*.*'])
    .pipe(plugins.sourcemaps.init({loadMaps: true}))
    .pipe(gulp.dest(destDir+'/js/libs'));
    return stream;
});

gulp.task('scripts', function(cb){
  runSequence('scripts:clean', 'scripts:concat', 'scripts:min', 'scripts:copy', 'scripts:clean', cb)  
});

gulp.task('fonts', function() {
  return gulp.src([srcDir+'/fonts/**/*.*'])
    .pipe(gulp.dest(destDir+'/fonts'));
});

// Optimizes the images that exists
gulp.task('images', function () {
  return gulp.src(srcDir+'/images/**')
    .pipe(plugins.changed(destDir+'/images'))
    .pipe(plugins.imagemin({
      // Lossless conversion to progressive JPGs
      progressive: true,
      // Interlace GIFs for progressive rendering
      interlaced: true
    }))
    .pipe(gulp.dest(destDir+'/images'))
    .pipe(plugins.size({title: 'images'}));
});

gulp.task('html', function() {
  gulp.src(srcDir+'/**/*.html')
    .pipe(gulp.dest(destDir+'/'));
});

gulp.task('browser-sync', ['styles', 'scripts'], function() {
  browserSync({
    server: {
      baseDir: destDir + "/",
      injectChanges: true // this is new
    }
  });
});

gulp.task('deploy', function() {
  return gulp.src(destDir+'/**/*')
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
      gutil.log('File', gutil.colors.cyan(evt.path.replace(new RegExp('/.*(?=/' + srcDir+ ')/'), '')), 'was', gutil.colors.magenta(evt.type));
  }

  // Watch .html files
  gulp.watch(srcDir+'/**/*.html', ['html', browserSync.reload]).on('change', function(evt) {
        changeEvent(evt);
    });
  gulp.watch(destDir+"/*.html").on('change', browserSync.reload);
  // Watch .css files
  gulp.watch(srcDir+'/css/**/*.css', ['styles', browserSync.reload])
      .on('error', swallowError)
      .on('change', function(evt) {
          changeEvent(evt);
      });
  // Watch .js files
  gulp.watch(srcDir+'/js/**/*.js', ['scripts', browserSync.reload])
      .on('error', swallowError)
      .on('change', function(evt) {
          changeEvent(evt);
      });
  // Watch image files
  gulp.watch(srcDir+'/images/**/*', ['images', browserSync.reload])
      .on('change', function(evt) {
          changeEvent(evt);
      });
  gulp.watch(destDir+'/images/**/*', ['change', browserSync.reload])
      .on('change', function(evt) {
          changeEvent(evt);
      });  
});

gulp.task('clean', ['scripts:clean'], function() {
    del([srcDir+'/js/all.js']);
    return del([destDir+'/css', destDir+'/js', destDir+'/images', destDir+'/fonts', destDir+"/**/*.html"]);
});

gulp.task('serve', function() { 
    gulp.start('init', 'styles', 'scripts', 'fonts', 'images', 'html', 'browser-sync', 'watch');    
});

gulp.task('default', function() { 
    gulp.start('styles', 'scripts', 'fonts', 'images', 'html');    
});
