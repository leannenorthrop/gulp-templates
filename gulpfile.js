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
    srcDir = "src",
    destDir = "./dist";


gulp.task('styles', function() {
  var processors = [
        autoprefixer({browsers: ['last 2 version', 'safari 5', 'ie 8', 'ie 9', 'opera 12.1', 'ios 6', 'android 4']}),
        csswring({
          preserveHacks: true,
          removeAllComments: true
        })
    ];
  gulp.src([srcDir+'/css/**/*.css'])
    .pipe(gulp.dest(destDir+'/css'))
    .pipe(sourcemaps.init({loadMaps: true}))
    .pipe(rename({suffix: '.min'}))
    .pipe(postcss([csswring]))
    .pipe(sourcemaps.write('./', {includeContent: false, sourceRoot: '../css'}))
    .pipe(gulp.dest(destDir+'/css'));

});

gulp.task('scripts', function() {
  return gulp.src([srcDir+'/js/**/*.js'])
    .pipe(gulp.dest(destDir+'/js'))
    .pipe(sourcemaps.init({loadMaps: true}))
    .pipe(rename({suffix: '.min'}))
    .pipe(concat('all.js'))
    .pipe(sourcemaps.write('./',{includeContent: true, sourceRoot: '../js'}))
    .pipe(gulp.dest(destDir+'/js'));
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
  // Watch .html files
  gulp.watch(srcDir+'/**/*.html', ['html', browserSync.reload]);
  gulp.watch(destDir+"/*.html").on('change', browserSync.reload);
  // Watch .css files
  gulp.watch(srcDir+'/css/**/*.css', ['styles', browserSync.reload]);
  // Watch .js files
  gulp.watch(srcDir+'/js/**/*.js', ['scripts', browserSync.reload]);
  // Watch image files
  gulp.watch(srcDir+'/images/**/*', ['images', browserSync.reload]); 
  gulp.watch(destDir+'/images/**/*', ['change', browserSync.reload]); 
});

gulp.task('default', function() {
    gulp.start('styles', 'scripts', 'fonts', 'images', 'html', 'browser-sync', 'watch');
});
