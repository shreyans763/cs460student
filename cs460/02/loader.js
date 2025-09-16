// loader.js — scene save/load for A2 (works on GitHub Pages)
var CAMERAS = [];

function download() {
  if (!window.r) return;

  var ALL_OBJECTS = [];

  // NOTE: r.Ha is XTK's internal array of scene objects (matching course snippet)
  for (var i = 0; i < r.Ha.length; i++) {
    var obj = r.Ha[i];
    if (!obj || !obj.visible) continue;

    var type    = obj.g;                  // class name as string (e.g., 'cube', 'sphere')
    var color   = obj.color;
    var matrix  = obj.transform.matrix;   // 4x4 matrix as Float32Array
    var radius  = obj.radius;             // for spheres
    var lengthX = obj.lengthX;            // for cubes
    var lengthY = obj.lengthY;
    var lengthZ = obj.lengthZ;

    ALL_OBJECTS.push([type, color, matrix, radius, lengthX, lengthY, lengthZ]);
  }

  var out = {};
  out.objects = ALL_OBJECTS;

  if (typeof CAMERAS === 'undefined' || CAMERAS.length === 0) {
    CAMERAS = [r.camera.view];
  }
  out.camera = CAMERAS;

  // trigger a file download (scene.json)
  var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(out));
  var a = document.createElement('a');
  a.setAttribute("href", dataStr);
  a.setAttribute("download", "scene.json");
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function upload(scene) {
  if (!window.r) return;

  // hide all existing objects
  for (var i = 0; i < r.Ha.length; i++) {
    if (r.Ha[i]) r.Ha[i].visible = false;
  }

  var req = new XMLHttpRequest();
  req.responseType = 'json';
  req.open('GET', scene, true);

  req.onload = function () {
    var loaded = req.response;
    if (!loaded) { alert('scene.json not found or invalid.'); return; }

    // restore objects
    var objs = loaded.objects || [];
    for (var k = 0; k < objs.length; k++) {
      var objArr  = objs[k];   // [type, color, matrix, radius, lengthX, lengthY, lengthZ]
      var type    = objArr[0];
      var color   = objArr[1];
      var matrix  = objArr[2];
      var radius  = objArr[3];
      var lengthX = objArr[4];
      var lengthY = objArr[5];
      var lengthZ = objArr[6];

      if (type === 'cube') {
        var c = new X.cube();
        c.color = color;
        c.transform.matrix = new Float32Array(Object.values(matrix));
        if (lengthX) c.lengthX = lengthX;
        if (lengthY) c.lengthY = lengthY;
        if (lengthZ) c.lengthZ = lengthZ;
        r.add(c);

      } else if (type === 'sphere') {
        var s = new X.sphere();
        s.color = color;
        s.transform.matrix = new Float32Array(Object.values(matrix));
        if (radius) s.radius = radius;
        r.add(s);
      }
    }

    // restore camera views
    if (loaded.camera && loaded.camera.length) {
      r.camera.view = new Float32Array(Object.values(loaded.camera[0]));
      CAMERAS = [];
      for (var j = 0; j < loaded.camera.length; j++) {
        CAMERAS.push(new Float32Array(Object.values(loaded.camera[j])));
      }
    }
  };

  req.onerror = function () {
    alert('Could not fetch ' + scene + '. Did you copy it into cs460/02/ and push?');
  };

  req.send(null);
}
