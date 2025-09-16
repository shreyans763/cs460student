function download() {

  // get all objects
  ALL_OBJECTS = [];

  for (var i = 0; i<r.Ha.length; i++) {
    // note: r.Ha are all objects in the scene

    if (!r.Ha[i].visible)
      continue;

    var type = r.Ha[i].g; // g is the type as string
    var color = r.Ha[i].color;
    var matrix = r.Ha[i].transform.matrix;
    var radius = r.Ha[i].radius;
    var lengthX = r.Ha[i].lengthX;
    var lengthY = r.Ha[i].lengthY;
    var lengthZ = r.Ha[i].lengthZ;
    ALL_OBJECTS.push([type, color, matrix, radius, lengthX, lengthY, lengthZ]);

  }


  // create JSON object
  var out = {};
  out['objects'] = ALL_OBJECTS;
  if (typeof CAMERAS == 'undefined' || CAMERAS.length == 0) {
    CAMERAS = [r.camera.view];
  }
  out['camera'] = CAMERAS; //r.camera.view;

  // from https://stackoverflow.com/a/30800715
  var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(out));

  var downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href",     dataStr);
  downloadAnchorNode.setAttribute("download", "scene.json");
  document.body.appendChild(downloadAnchorNode); // required for firefox
  downloadAnchorNode.click();
  downloadAnchorNode.remove();

}

function upload(scene) {

  // remove all objects in the scene
  for (var obj in r.Ha) {

    // r.remove(r.Ha[obj]);
    r.Ha[obj].visible = false;

  }

  var req = new XMLHttpRequest();
  req.responseType = 'json';
  req.open('GET', scene, true);
  req.onload  = function() {
    loaded = req.response;

    // parse cubes
    for (var obj in loaded['objects']) {

      obj = loaded['objects'][obj];

      // [type, color, matrix, radius, lengthX, lengthY, lengthZ]

      type = obj[0];
      color = obj[1];
      matrix = obj[2];
      radius = obj[3];
      lengthX = obj[4];
      lengthY = obj[5];
      lengthZ = obj[6];

      if (type == 'cube') {

        loaded_cube = new X.cube();
        loaded_cube.color = color;
        loaded_cube.transform.matrix = new Float32Array(Object.values(matrix));
        loaded_cube.lengthX = lengthX;
        loaded_cube.lengthY = lengthY;
        loaded_cube.lengthZ = lengthZ;

        r.add(loaded_cube);

      } else if (type == 'sphere') {
        
        loaded_sphere = new X.sphere();
        loaded_sphere.color = color;
        loaded_sphere.transform.matrix = new Float32Array(Object.values(matrix));
        loaded_sphere.radius = radius;

        r.add(loaded_sphere);
      }




    }

    // restore camera
    r.camera.view = new Float32Array(Object.values(loaded['camera'][0]));

    CAMERAS = [];
    for (var cam in loaded['camera']) {

      cam = loaded['camera'][cam];
      CAMERAS.push(new Float32Array(Object.values(cam)));

    }



  };
  req.send(null);
  
}

