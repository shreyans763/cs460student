// loader.js 
var CAMERAS = [];

/** Download the current scene as scene.json */
function download() {
  if (!window.r) return;

  var ALL_OBJECTS = [];

  // NOTE: r.Ha is XTK's internal array of scene objects (matches course snippet)
  for (var i = 0; i < r.Ha.length; i++) {
    var obj = r.Ha[i];
    if (!obj || !obj.visible) continue;

    var type    = obj.g;                // class name as string ('cube', 'sphere', ...)
    var color   = obj.color;
    var matrix  = obj.transform.matrix; // Float32Array
    var radius  = obj.radius;           // for spheres
    var lengthX = obj.lengthX;          // for cubes
    var lengthY = obj.lengthY;
    var lengthZ = obj.lengthZ;

    ALL_OBJECTS.push([type, color, matrix, radius, lengthX, lengthY, lengthZ]);
  }

  var out = { objects: ALL_OBJECTS };

  if (!CAMERAS || CAMERAS.length === 0) {
    CAMERAS = [r.camera.view];
  }
  out.camera = CAMERAS;

  // trigger file download
  var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(out));
  var a = document.createElement('a');
  a.href = dataStr;
  a.download = "scene.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Load a scene.json file from the same folder (works on GitHub Pages) */
function upload(scene) {
  if (!window.r) return;

  // hide all existing objects
  for (var i = 0; i < r.Ha.length; i++) {
    if (r.Ha[i]) r.Ha[i].visible = false;
  }

  // Cache-bust and be tolerant to weird MIME types on Pages
  fetch(scene + '?v=' + Date.now(), { cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) throw new Error('HTTP ' + res.status);

      // try JSON first, then fallback to text->JSON parse
      try {
        return await res.json();
      } catch (_) {
        const txt = await res.text();
        return JSON.parse(txt);
      }
    })
    .then((loaded) => {
      if (!loaded || !loaded.objects) throw new Error('Invalid JSON schema');

      // restore objects
      var objs = loaded.objects;
      for (var k = 0; k < objs.length; k++) {
        var arr     = objs[k]; // [type, color, matrix, radius, lengthX, lengthY, lengthZ]
        var type    = arr[0];
        var color   = arr[1];
        var matrix  = arr[2];
        var radius  = arr[3];
        var lengthX = arr[4];
        var lengthY = arr[5];
        var lengthZ = arr[6];

        if (type === 'cube') {
          var c = new X.cube();
          c.color = color;
          c.transform.matrix = new Float32Array(Object.values(matrix));
          if (lengthX != null) c.lengthX = lengthX;
          if (lengthY != null) c.lengthY = lengthY;
          if (lengthZ != null) c.lengthZ = lengthZ;
          r.add(c);

        } else if (type === 'sphere') {
          var s = new X.sphere();
          s.color = color;
          s.transform.matrix = new Float32Array(Object.values(matrix));
          if (radius != null) s.radius = radius;
          r.add(s);
        }
      }

      // restore cameras
      if (loaded.camera && loaded.camera.length) {
        r.camera.view = new Float32Array(Object.values(loaded.camera[0]));
        CAMERAS = [];
        for (var j = 0; j < loaded.camera.length; j++) {
          CAMERAS.push(new Float32Array(Object.values(loaded.camera[j])));
        }
      }
    })
    .catch((err) => {
      console.error(err);
      alert('scene.json not found or invalid. Make sure it exists at cs460/02/scene.json and you pushed it.');
    });
}
