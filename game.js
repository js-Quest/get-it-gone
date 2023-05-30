
document.addEventListener("DOMContentLoaded", function () {
  const game = new Game();
  window.game = game; //can set game.cube.material.wireframe to true in console to see them, can use console to manipulate properties of scene
});
// class Game{
//   constructor(){
//     this.scene = new THREE.Scene();
//     this.camera = new THREE.PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 0.1, 1000); //75 is viewing width, then aspect ratio, nearest you can render is 0.1 from camera, furthest away is 1000 
//     this.renderer = new THREE.WebGLRenderer();
//     this.renderer.setSize(window.innerWidth, window.innerHeight); //canvas dimensions
//     document.body.appendChild(this.renderer.domElement); //create the canvas

//     const geometry = new THREE.BoxGeometry(1,1,1); //w, h, depth
//     const light = new THREE.DirectionalLight(0xffffff); // white color
//     light.position.set(0, 20, 10); // x y z positions
//     const ambient = new THREE.AmbientLight(0x707070); //greyish white color

//     const material = new THREE.MeshPhongMaterial({color: 0x00aaff}); //blue

//     this.cube = new THREE.Mesh(geometry, material); //make a cube (a mesh)

//     this.scene.add(this.cube);
//     this.scene.add(light);
//     this.scene.add(ambient);

//     this.camera.position.z = 3; // camera is 3 away from center of scene

//     this.animate();
//   }

//   animate(){
//     const game = this;
//     requestAnimationFrame(function(){ game.animate(); });

//     this.cube.rotation.x += 0.01;
//     this.cube.rotation.y += 0.01;

//     this.renderer.render(this.scene, this.camera)
//   }
// }

class Game {
  constructor() {
    if (!Detector.webgl) Detector.addGetWebGLMessage(); //need WebGL in browser

    this.modes = Object.freeze({
      NONE: Symbol('none'), //no mode
      PRELOAD: Symbol('preload'), // preloading assets
      INITIALIZING: Symbol('initializing'), //initializing game
      CREATING_LEVEL: Symbol('creating_level'), //create level
      ACTIVE: Symbol('active'), //game is playable
      GAMEOVER: Symbol('gameover')
    });

    this.mode = this.modes.NONE //initial mode is NONE

    this.container; //where game is rendered
    this.player = {}; //object for player info
    this.stats;
    this.controls;
    this.camera;
    this.scene; //where it happens lol
    this.renderer;
    this.cellSize = 16; //cell for animation
    this.interactive = false;
    this.levelIndex = 0;
    this._hints = 0;
    this.score = 0;

    this.messages = {
      text: [
        "Test Mode",
        "see what happens"
      ],
      index: 0
    }
    this.container = document.createElement('div'); //container for animation
    this.container.style.height = '100%';
    document.body.appendChild(this.container);

    const game = this;
    this.anims = ['run', 'gather-objects', 'look-around']; //fbx file animation names in assets folder
    this.assetsPath = './assets/';

    const options = {
      assets: [], //array for assets to be pushed into
      oncomplete: function () { //cb function to be called when loading finishes
        game.init();
        game.animate();
      }
    }

    this.anims.forEach(function (anim) { options.assets.push(`${game.assetsPath}fbx/${anim}.fbx`) })

    this.mode = this.modes.PRELOAD;

    this.clock = new THREE.Clock(); //constructor built-in from Three.js lib

    const preloader = new Preloader(options); //!want to make a preloader sometime later for user interface

    window.onError = function (error) {
      console.error(JSON.stringify(error))
    }
  }

  set activeCamera(object) {
    this.player.cameras.active = object;
  }

  init() {
    this.mode = this.modes.INITIALIZING;

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);//45 is viewing width, then aspect ratio, nearest you can render is 1 from camera, furthest away is 2000 

    this.scene = new THREE.Scene(); //time to make a scene
    this.scene.background = new THREE.Color(0xa0a0a0) //grey
    this.scene.fog = new THREE.Fog(0xa0a0a0, 200, 1000) //linear fog grows denser with distance, params: color, nearest distance to apply, farthest to stop applying fog.

    let light = new THREE.HemisphereLight(0xffffff, 0x444444); //above scene, fades from sky color to ground color dark grey.
    //skycolor white, groundcolor grey, default intensity is 1.
    light.position.set(0, 200, 0); //xyz params of light origination
    this.scene.add(light); //let there be (hemisphere)light.

    light = new THREE.DirectionalLight(0xffffff); //white light emitting from a direction
    light.position.set(0, 200, 100);
    light.castShadow = true;
    light.shadow.camera.top = 180; //boundaries for the camera's FOV (field of view) for casting shadows
    light.shadow.camera.bottom = -100;
    light.shadow.camera.left = -120;
    light.shadow.camera.right = 120;
    this.scene.add(light);

    //the ground plane, create plane, give it grey material, plane will not allow writing to depth buffer so objects can render correctly.  
    var mesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(2000, 2000), new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false }));
    mesh.rotation.x = - Math.Pi / 2; //Math.Pi/2 is -90 degrees so plane sits flat.
    mesh.receiveShadow = true; //plane can get shadows cast onto it
    this.scene.add(mesh); //render ground plane to scene

    var grid = new THREE.GridHelper(2000, 40, 0x000000, 0x000000); //show grid, 2000w 2000h, 40 divisions/lines on each axis, black lines.
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    this.scene.add(grid);

    //model
    const loader = new THREE.FBXLoader();
    const game = this;

    loader.load(`${this.assetsPath}fbx/girl-walk.fbx`, function (object) {
      object.mixer = new THREE.AnimationMixer(object);
      game.player.mixer = object.mixer;
      game.player.root = object.mixer.getRoot();
      // get Root is builtin method from Three.js, gets top-level object of the animation object (aka player) hierarchy (aka skeleton).

      object.name = 'Character';
      object.traverse(function (child) { //iterate through child objects of the loaded object
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      game.scene.add(object);
      game.player.object = object;
      game.player.walk = object.animations[0];

      //add mobile controls
      game.joystick = new JoyStick({
        onMove: game.playerControl, //onMove cb function 
        game: game
      })

      game.createCameras();
      game.loadNextAnim(loader);
    });

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    // anitialias makes edges smoother
    this.renderer.setPixelRatio(window.devicePixelRatio); //pixel ratio
    this.renderer.setSize(window.innerWidth, window.innerHeight); //window size
    this.renderer.shadowMap.enabled = true; //shadows
    this.container.appendChild(this.renderer.domElement); //render on screen

    window.addEventListener('resize', function () { game.onWindowResize(); }, false);//'useCapture' param false, so eventlistener will trigger event on innermost element and then propagate to parents, so parent events go first. 
  }

  playerControl(forward, turn) {
    if (forward > 0) {
      if (this.player.action != 'walk') this.action = 'walk';
    } else {
      if (this.player.action == 'walk') this.action = 'look-around';
    }
    if (forward == 0 && turn == 0) {
      delete this.player.move; //stop player from moving if no event 
    } else {
      this.player.move = { forward, turn };
    }
  }


  createCameras() {
    const offset = new THREE.Vector3(0, 60, 0);
    const front = new THREE.Object3D();
    front.position.set(112, 100, 200);
    front.quaternion.set(0.07133122876303646, -0.17495722675648318, -0.006135162916936811, -0.9819695435118246);
    front.parent = this.player.object;
    const back = new THREE.Object3D();
    back.position.set(0, 100, -250);
    back.quaternion.set(-0.001079297317118498, -0.9994228131639347, -0.011748701462123836, -0.031856610911161515);
    back.parent = this.player.object;
    const wide = new THREE.Object3D();
    wide.position.set(178, 139, 465);
    wide.quaternion.set(0.07133122876303646, -0.17495722675648318, -0.006135162916936811, -0.9819695435118246);
    wide.parent = this.player.object;
    const overhead = new THREE.Object3D();
    overhead.position.set(0, 400, 0);
    overhead.quaternion.set(0.02806727427333993, 0.7629212874133846, 0.6456029820939627, 0.018977008134915086);
    overhead.parent = this.player.object;
    const collect = new THREE.Object3D();
    collect.position.set(40, 82, 94);
    collect.quaternion.set(0.07133122876303646, -0.17495722675648318, -0.006135162916936811, -0.9819695435118246);
    collect.parent = this.player.object;
    this.player.cameras = { front, back, wide, overhead, collect };
    game.activeCamera = this.player.cameras.front;
  }

  loadNextAnim(loader) {
    let anim = this.anims.pop();
    const game = this;
    loader.load(`${this.assetsPath}fbx/${anim}.fbx`, function (object) {
      game.player[anim] = object.animations[0];
      if (game.anims.length > 0) {
        game.loadNextAnim(loader);
      } else {
        delete game.anims;
        game.action = 'look-around';
        game.mode = game.modes.ACTIVE;
      }
    });
  };

  set action(name) {
    const anim = this.player[name];
    const action = this.player.mixer.clipAction(anim, this.player.root);
    //returns an animation action for the passed clip, using the anim from the anims.
    action.time = 0; //this animation is not a multiple loop
    this.player.mixer.stopAllAction(); //stops current actions to make room for the new action
    if (this.player.action == 'gather-objects') {
      delete this.player.mixer._listeners['finished']; //removes 'finished' listener via three.min.js lib methods
    }
    if (name == 'gather-objects') {
      action.loop = THREE.LoopOnce; //one animation loop
      const game = this;
      this.player.mixer.addEventListener('finished', function () {
        console.log('gather-objs anim complete');
        game.action = 'look-around';
      });
    }
    this.player.action = name;
    action.fadeIn(0.5); //smooth animation transition
    action.play();
  }

  animate() {
    const game = this;
    const dt = this.clock.getDelta(); //using 'delta time' helps different devices playing at different frame speeds instead of hard-coding in a value of time between frames.
    requestAnimationFrame(function () { game.animate() });

    if (this.player.mixer != undefined && this.mode == this.modes.ACTIVE) {
      this.player.mixer.update(dt);
    }
    if (this.player.move != undefined) {
      if (this.player.move.forward > 0) this.player.object.context.translateZ(dt * 100); //player translating on z-axis
      this.player.object.rotateY(this.player.move.turn * dt); //rotate player on the y-axis
    }
    if (this.player.cameras != undefined && this.player.cameras.active != undefined) {
      //linear interpolation (lerp) used to smooth camera transition to the active camera's world position at a weight of 0.05
      this.camera.position.lerp(this.player.cameras.active.getWorldPosition(new THREE.Vector3()), 0.05); //Vector3 from three.js for 3D stuff
      //spherical linear interpolation (slerp) method to transition between two rotations (quaternions), provides smooth transition.
      this.camera.quaternion.slerp(this.player.cameras.active.getWorldQuaternion(new THREE.Quaternion()), 0.05);
    }
    this.renderer.render(this.scene, this.camera);
  }

}

class JoyStick {
  constructor(options) {
    const circle = document.createElement('div');
    //joystick is grey circle in the middle of the bottom of screen
    circle.style.cssText = 'position: absolute; bottom: 35px; width: 80px; height: 80px; background: rgba(120, 120, 120, 0.5); border: medium solid #444; border-radius: 50%; left: 50%; transform:translateX(-50%);'
    const thumb = document.createElement('div');
    thumb.style.cssText('position: absolute; top: 20px; left: 20px; width: 40px; height: 40px; border-radius: 50%; background: #853e3e;');
    circle.appendChild(thumb); //circle in a circle for joystick
    document.appendChild(circle); //render on screen
    this.domElement = thumb; //assigned so can access outside of constructor, the domElement is what the user will be moving around, by way of event listeners. 
    this.maxRadius = options.maxRadius || 40; //can't be more than 40px away from center of thumb origin
    this.maxRadiusSquared = this.maxRadius * this.maxRadius; //maths for circle
    this.onMove = options.onMove; //cb fxn assignment for when joystick moved
    this.game = options.game; //allow access to game object from joystick class
    this.origin = { left: this.domElement.offsetLeft, top: this.domElement.offsetTop }; //use offset properties to set origin relative to parent element to calculate position of thumb during joystick movement

    if (this.domElement != undefined) {
      const joystick = this;
      if ('ontouchstart' in window) {
        this.domElement.addEventListener('touchstart', function (evt) { joystick.tap(evt) }); //if window object has touch event properties, touchstart.
      } else {
        this.domElement.addEventListener('mousedown', function (evt) { joystick.tap(evt) }); //mousedown if no touch properties exist on window object
      }
    }
  }

  //touch instance properties used
  getMousePosition(evt) { //ternary operators to get x and y values relative to viewport depending on touch or mouse events, clientX and clientY
    let clientX = evt.targetTouches ? evt.targetTouches[0].pageX : evt.clientX;
    let clientY = evt.targetTouches ? evt.targetTouches[0].pageY : evt.clientY;
    //returns `{x: clientX, y: clientY}`
  }

  tap(evt) { //cb fxn for mouse or touch events
    evt = evt || window.event; //checks to see if event exists for browsers new and older.
    //get mouse position at start
    this.offset = this.getMousePosition(evt);
    const joystick = this; //assign to reference current Joystick instance
    if ('ontouchstart' in window) {
      document.ontouchmove = function (evt) { joystick.move(evt) }; //touch capable
      document.ontouchend = function (evt) { joystick.up(evt) };
    } else {
      document.onmousemove = function (evt) { joystick.move(evt) }; //mouse only
      document.onmouseup = function (evt) { joystick.up(evt) };
    }
  }

  move(evt) { //cb fxn for when user moves/uses joystick
    evt = evt || window.event;
    const mouse = this.getMousePosition(evt); //get new cursor position
    let left = mouse.x - this.offset.x; //this.offset = mouse
    let top = mouse.y - this.offset.y; //get displacement of joystick

    const sqMag = left * left + top * top; //squareMagnitude
    if (sqMag > this.maxRadiusSquared) { //check to see if joystick is within defined range - if outside of range then reassign values scaled down to keep within range.
      const magnitude = Math.sqrt(sqMag); //square root of squared magnitude
      left /= magnitude;
      top /= magnitude;
      left *= this.maxRadius;
      top *= this.maxRadius;
    }

    // set new position of element
    this.domElement.style.left = `${left + this.domElement.clientWidth / 2}px`;
    this.domElement.style.top = `${top + this.domElement.clientHeight / 2}px`;

    const forward = -(top - this.origin.top + this.domElement.clientHeight / 2) / this.maxRadius;
    const turn = (left - this.origin.left + this.domElement.clientWidth / 2) / this.maxRadius;

    if (this.onMove != undefined) {
      this.onMove.call(this.game, forward, turn);
    } //use 'call' method to set value of 'this' to this.game inside the onMove cb function for when joystick is moved, and pass 'forward' and 'turn' as arguments TO the onMove cb function.
  }

  up(evt) { // cb function triggered when user 'releases' joystick (to stop movement)
    if ('ontouchstart' in window) { //use of 'in' operator on 'ontouchstart' property of the window object
      document.ontouchmove = null;
      document.touchend = null;
    } else {
      document.onmousemove = null;
      document.onmouseup = null;
    }
    this.domElement.style.top = `${this.origin.top}px`; //reset location of 'thumb' to center of joystick (the origin of thumb)
    this.domElement.style.left = `${this.origin.left}px`;
    this.onMove.call(this.game, 0, 0); // 0, 0 for no input of movement when joystick is released.
  }
}

class Preloader {
  constructor(options) {
    this.assets = {};
    for (let asset of options.assets) {
      this.assets[asset] = { loaded: 0, complete: false };
      this.load(asset);
    }
    this.container = options.container;

    if (options.onprogress == undefined) {
      this.onprogress = onprogress;
      this.domElement = document.createElement("div");
      this.domElement.style.position = 'absolute';
      this.domElement.style.top = '0';
      this.domElement.style.left = '0';
      this.domElement.style.width = '100%';
      this.domElement.style.height = '100%';
      this.domElement.style.background = '#000';
      this.domElement.style.opacity = '0.7';
      this.domElement.style.display = 'flex';
      this.domElement.style.alignItems = 'center';
      this.domElement.style.justifyContent = 'center';
      this.domElement.style.zIndex = '1111';
      const barBase = document.createElement("div");
      barBase.style.background = '#aaa';
      barBase.style.width = '50%';
      barBase.style.minWidth = '250px';
      barBase.style.borderRadius = '10px';
      barBase.style.height = '15px';
      this.domElement.appendChild(barBase);
      const bar = document.createElement("div");
      bar.style.background = '#2a2';
      bar.style.width = '50%';
      bar.style.borderRadius = '10px';
      bar.style.height = '100%';
      bar.style.width = '0';
      barBase.appendChild(bar);
      this.progressBar = bar;
      if (this.container != undefined) {
        this.container.appendChild(this.domElement);
      } else {
        document.body.appendChild(this.domElement);
      }
    } else {
      this.onprogress = options.onprogress;
    }

    this.oncomplete = options.oncomplete;

    const loader = this;
    function onprogress(delta) {
      const progress = delta * 100;
      loader.progressBar.style.width = `${progress}%`;
    }
  }

  checkCompleted() {
    for (let prop in this.assets) {
      const asset = this.assets[prop];
      if (!asset.complete) return false;
    }
    return true;
  }

  get progress() {
    let total = 0;
    let loaded = 0;

    for (let prop in this.assets) {
      const asset = this.assets[prop];
      if (asset.total == undefined) {
        loaded = 0;
        break;
      }
      loaded += asset.loaded;
      total += asset.total;
    }

    return loaded / total;
  }

  load(url) {
    const loader = this;
    var xobj = new XMLHttpRequest();
    xobj.overrideMimeType("application/json");
    xobj.open('GET', url, true);
    xobj.onreadystatechange = function () {
      if (xobj.readyState == 4 && xobj.status == "200") {
        loader.assets[url].complete = true;
        if (loader.checkCompleted()) {
          if (loader.domElement != undefined) {
            if (loader.container != undefined) {
              loader.container.removeChild(loader.domElement);
            } else {
              document.body.removeChild(loader.domElement);
            }
          }
          loader.oncomplete();
        }
      }
    };
    xobj.onprogress = function (e) {
      const asset = loader.assets[url];
      asset.loaded = e.loaded;
      asset.total = e.total;
      loader.onprogress(loader.progress);
    }
    xobj.send(null);
  }
}