
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
  constructor(){
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
      text:[
        "Test Mode",
        "see what happens"
      ],
      index:0
    }
    this.container = document.createElement('div'); //container for animation
    this.container.style.height = '100%';
    document.body.appendChild(this.container);

    const game = this;
    this.anims = ['run', 'gather-objects', 'look-around']; //fbx file animation names in assets folder
    this.assetsPath = 'assets';

    const options = {
      assets:[], //array for assets to be pushed into
      oncomplete: function(){ //cb function to be called when loading finishes
        game.init();
        game.animate();
      }
    }

    this.anims.forEach(function(anim){options.assets.push(`${game.assetsPath}fbx/${anim}.fbx`)})

    this.mode = this.modes.PRELOAD; 

    this.clock = new THREE.Clock(); //constructor built-in from Three.js lib

    // const preloader = new Preloader(options); //!want to make a preloader sometime later for user interface

    window.onError = function(error){
      console.error(JSON.stringify(error))
    }
  }

  set activeCamera(object){
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
    light.position.set(0,200,0); //xyz params of light origination
    this.scene.add(light); //let there be (hemisphere)light.

    light = new THREE.DirectionalLight(0xffffff); //white light emitting from a direction
    light.position.set(0,200,100);
    light.castShadow = true;
    light.shadow.camera.top = 180; //boundaries for the camera's FOV (field of view) for casting shadows
    light.shadow.camera.bottom = -100;
    light.shadow.camera.left = -120;
    light.shadow.camera.right = 120;
    this.scene.add(light);

    //the ground plane, create plane, give it grey material, plane will not allow writing to depth buffer so objects can render correctly.  
    var mesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(2000,2000), new THREE.MeshPhongMaterial({color: 0x999999, depthWrite: false}));
    mesh.rotation.x = - Math.Pi / 2; //Math.Pi/2 is -90 degrees so plane sits flat.
    mesh.receiveShadow = true; //plane can get shadows cast onto it
    this.scene.add(mesh); //render ground plane to scene

    var grid = new Three.GridHelper(2000, 40, 0x000000, 0x000000); //show grid, 2000w 2000h, 40 divisions/lines on each axis, black lines.
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    this.scene.add(grid);

    //model
    const loader = new THREE.FBXLoader();
    const game = this;

    loader.load(`${this.assetsPath}fbx/girl-walk.fbx`, function(object){
      object.mixer = new THREE.AnimationMixer(object);
      game.player.mixer = object.mixer;
      game.player.root = object.mixer.getRoot();

      object.name = 'Character';
      object.traverse( function(child){ //iterate through child objects of the loaded object
        if (child.isMesh){
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      game.scene.add(object);
      game.player.object = object;
      game.player.walk = object.animations[0];

      //add mobile controls
      game.joystick = new JoyStick({ 
        onMove: game.playerControl,
        game: game
      })

      game.createCameras();
      game.loadNextAnim(loader);
    });

    this.renderer = new THREE.WebGLRenderer({ antialias: true });	//antialias makes edges smoother
    this.renderer.setPixelRatio(window.devicePixelRatio); //pixel ratio dependent on device
    this.renderer.setSize(window.innerWidth, window.innerHeight); //window size dependent on device
    this.renderer.shadowMap.enabled = true; //shadows allowed
    this.container.appendChild(this.renderer.domElement); //render on screen

    window.addEventListener('resize', function(){ game.onWindowResize()}, false); //'useCapture' param false, so eventlistener will trigger event on innermost element and then propagate to parents, so parent events go first. 
  }
  
  playerControl(forward, turn){
    if (forward>0){
      if (this.player.action!='walk') this.action = 'walk';
    }else{
      if (this.player.action=='walk') this.action = 'look-around';
    }
    if (forward==0 && turn==0){
      delete this.player.move; //stop player from moving if no event 
    }else{
      this.player.move = {forward, turn};
    }
  }
}

class JoyStick{
  constructor(options){
    const circle = document.createElement('div');
    //joystick is grey circle in the middle of the bottom of screen
    circle.style.cssText = 'position: absolute; bottom: 35px; width: 80px; height: 80px; background: rgba(120, 120, 120, 0.5); border: medium solid #444; border-radius: 50%; left: 50%; transform:translateX(-50%);'
    const thumb = document.createElement('div');
    thumb.style.cssText('position: absolute; top: 20px; left: 20px; width: 40px; height: 40px; border-radius: 50%; background: #853e3e;');
    circle.appendChild(thumb); //circle in a circle for joystick
    document.appendChild(circle); //render on screen
    this.domElement = thumb; //assigned so can access outside of constructor 
    this.maxRadius = options.maxRadius || 40; //can't be more than 40px away from center of thumb origin
    this.maxRadiusSquared = this.maxRadius*this.maxRadius; //maths for circle
    this.onMove = options.onMove; //cb fxn assignment for when joystick moved
    this.game = options.game; //allow access to game object from joystick class
    this.origin = {left:this.domElement.offsetLeft, top: this.domElement.offsetTop }; //use offset properties to set origin relative to parent element to calculate position of thumb during joystick movement

    if (this.domElement != undefined){
      const joystick = this;
      if ('ontouchstart' in window){
        this.domElement.addEventListener('touchstart', function(evt){joystick.tap(evt) }); //if window object has touch event properties, touchstart.
      }else{
        this.domElement.addEventListener('mousedown', function(evt){joystick.tap(evt) }); //mousedown if no touch properties exist on window object
      }
    }
  }

  //touch instance properties used
  getMousePosition(evt){ //ternary operators to get x and y values relative to viewport depending on touch or mouse events, clientX and clientY
    let clientX = evt.targetTouches ? evt.targetTouches[0].pageX : evt.clientX;
    let clientY = evt.targetTouches ? evt.targetTouches[0].pageY : evt.clientY;
    //returns `{x: clientX, y: clientY}`
  }

  tap(evt){ //cb fxn for mouse or touch events
    evt = evt || window.event; //checks to see if event exists for browsers new and older.
    //get mouse position at start
    this.offset = this.getMousePosition(evt);
    const joystick = this; //assign to reference current Joystick instance
    if ('ontouchstart' in window){
      document.ontouchmove = function(evt){joystick.move(evt)}; //touch capable
      document.ontouchend = function(evt){joystick.up(evt)};
    }else{
      document.onmousemove = function(evt){joystick.move(evt)}; //mouse only
      document.onmouseup = function(evt){joystick.up(evt)};
    }
  }

  move(evt){ //cb fxn for when user moves/uses joystick
    evt = evt || window.event; 
    const mouse = this.getMousePosition(evt); //get new cursor position
    let left = mouse.x - this.offset.x; //this.offset = mouse
    let top = mouse.y - this.offset.y; //get displacement of joystick

    const sqMag = left*left + top*top; //squareMagnitude
    if (sqMag > this.maxRadiusSquared){ //check to see if joystick is within defined range - if outside of range then reassign values scaled down to keep within range.
      const magnitude  = Math.sqrt(sqMag); //square root of squared magnitude
      left /= magnitude;
      top /= magnitude;
      left *= this.maxRadius;
      top *= this.maxRadius;
    }

    // set new position of element
    this.domElement.style.left = `${left + this.domElement.clientWidth/2}px`;
    this.domElement.style.top = `${top + this.domElement.clientHeight/2}px`;

    const forward = -(top - this.origin.top + this.domElement.clientHeight/2)/this.maxRadius;
    const turn = (left-this.origin.left + this.domElement.clientWidth/2)/this.maxRadius;

    if (this.onMove!=undefined){
      this.onMove.call(this.game, forward, turn);
    } //use 'call' method to set value of 'this' to this.game inside the onMove cb function for when joystick is moved, and pass 'forward' and 'turn' as arguments TO the onMove cb function.
  }

  up(evt){ // cb function triggered when user 'releases' joystick (to stop movement)
    if ('ontouchstart' in window){ //use of 'in' operator on 'ontouchstart' property of the window object
      document.ontouchmove = null;
      document.touchend = null;
    }else{
      document.onmousemove = null;
      document.onmouseup = null;
    }
    this.domElement.style.top = `${this.origin.top}px`; //reset location of 'thumb' to center of joystick (the origin of thumb)
    this.domElement.style.left = `${this.origin.left}px`;
    this.onMove.call(this.game, 0, 0); // 0, 0 for no input of movement when joystick is released.
  }

}