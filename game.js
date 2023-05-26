
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
      oncomplete: function(){
        game.init();
        game.animate();
      }
    }

    this.anims.forEach(function(anim){options.assets.push(`${game.assetsPath}fbx/${anim}.fbx`)})

    this.mode = this.modes.PRELOAD; 

    this.clock = new THREE.Clock(); //constructor built-in from Three.js lib

    const preloader = new Preloader(options); //!want to make a preloader sometime later

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
    
  }



}