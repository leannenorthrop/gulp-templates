var fs = require('fs');

var gulp = require('gulp'),
    watch = require('gulp-watch'),
    autoprefixer = require('gulp-autoprefixer'),
    jshint = require('gulp-jshint'),
    del = require('del'),
    notify = require('gulp-notify'),
    cache = require('gulp-cache'),
    plumber = require('gulp-plumber'),
    browserSync = require('browser-sync'),
    cp = require('child_process'),
    changed = require('gulp-changed'),
    imagemin = require('gulp-imagemin'),
    size = require('gulp-size'),
    ghPages = require('gulp-gh-pages'),
    rename = require('gulp-rename'),
    postcss = require('gulp-postcss'),
    sourcemaps = require('gulp-sourcemaps'),
    concat = require('gulp-concat'),
    csswring = require('csswring'),
    uglify = require('gulp-uglify'),
    vinylPaths = require('vinyl-paths'),
    gutil = require('gulp-util'),
    runSequence = require('run-sequence'),
    stylish = require('jshint-stylish-ex'),
    csslint = require('gulp-csslint'),
    gulpif = require('gulp-if'),
    failOnError = true;
    srcDir = "src",
    destDir = "./dist";

gulp.task('init', function() {
  failOnError = false;
});

gulp.task('styles', function() {
  var processors = [
        autoprefixer({browsers: ['last 2 version', 'safari 5', 'ie 8', 'ie 9', 'opera 12.1', 'ios 6', 'android 4']}),
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
    .pipe(csslint())
    .pipe(csslint.reporter())
    .pipe(gulpif(failOnError, csslint.reporter('fail')))
    .pipe(notify(getMessages))    
    .pipe(gulp.dest(destDir+'/css'))
    .pipe(sourcemaps.init({loadMaps: true}))
    .pipe(rename({suffix: '.min'}))
    .pipe(postcss([csswring]))
    .pipe(sourcemaps.write('./', {includeContent: false, sourceRoot: '../css'}))
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
      if (file.jshint.success) {
        // Don't show something if success
        return false;
      }

      var errors = file.jshint.results.map(function (data) {
        if (data.error) {
          return "(" + data.error.line + ':' + data.error.character + ') ' + data.error.reason;
        }
      }).join("\n");
      return (file.relative + " (" + file.jshint.results.length + " errors)\n" + errors);
    }

    var stream = gulp.src(['!'+ srcDir + '/js/libs/**/*.*', '!'+ srcDir+'/all.js', srcDir+'/js/**/*.js'])
    .pipe(jshint('.jshintrc'))
    .pipe(jshint.reporter(stylish))  
    .pipe(notify(getMessage))
    .pipe(gulpif(failOnError, jshint.reporter('fail')))
    .pipe(gulp.dest(destDir+'/js'))
    .pipe(concat('all.js'))
    .pipe(gulp.dest(srcDir+'/js'))
    .pipe(gulp.dest(destDir+'/js'))
    .on('error', notify.onError(function (error) {
      return error.message;
    }));
    return stream;
});

gulp.task('scripts:min', function() {
  var stream = gulp.src(['!'+ srcDir + '/js/libs/**/*.*', srcDir+'/js/**/*.js'])
    .pipe(plumber({errorHandler:failOnError}))
    .pipe(sourcemaps.init({loadMaps: true}))    
    .pipe(uglify().on('error', gutil.log))
    .pipe(rename({suffix: '.min'}))
    .pipe(sourcemaps.write('./',{includeContent: false, sourceRoot: '../js'}))
    .pipe(plumber.stop())
    .pipe(gulp.dest(destDir+'/js'));
    return stream;
});

gulp.task('scripts:copy', function() {
  var stream = gulp.src([srcDir + '/js/libs/**/*.*'])
    .pipe(sourcemaps.init({loadMaps: true}))
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
    .pipe(changed(destDir+'/images'))
    .pipe(imagemin({
      // Lossless conversion to progressive JPGs
      progressive: true,
      // Interlace GIFs for progressive rendering
      interlaced: true
    }))
    .pipe(gulp.dest(destDir+'/images'))
    .pipe(size({title: 'images'}));
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
    .pipe(ghPages())
    .pipe(notify("Deployed to github pages"));
});

gulp.task('watch', function() {
  function swallowError (error) {

    // If you want details of the error in the console
    console.log(gutil.colors.red(error.toString()));

    this.emit('end');
  }  
  // Watch .html files
  gulp.watch(srcDir+'/**/*.html', ['html', browserSync.reload]);
  gulp.watch(destDir+"/*.html").on('change', browserSync.reload);
  // Watch .css files
  gulp.watch(srcDir+'/css/**/*.css', ['styles', browserSync.reload]).on('error', swallowError);
  // Watch .js files
  gulp.watch(srcDir+'/js/**/*.js', ['scripts', browserSync.reload]).on('error', swallowError);
  // Watch image files
  gulp.watch(srcDir+'/images/**/*', ['images', browserSync.reload]); 
  gulp.watch(destDir+'/images/**/*', ['change', browserSync.reload]); 
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
