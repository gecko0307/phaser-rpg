var Game = {
    playerProps: {
        level: 1,
        xp: 0,
        hp: 100,
        mp: 100,
        xpToNextLevel: 0
    },
    
    mapObjects: [],
    
    citizens: [
        "doriana"
    ],
    
    enemies: []
};

Game.preload = function()
{
    Game.scene = this;

    this.load.image("tree001", "data/scenery/tree001.png");
    this.load.image("test", "data/test/test.png");
    
    this.load.image("village1", "data/maps/village1.png");
    this.load.tilemapTiledJSON("map1", "data/maps/map1.json");
    
    this.load.spritesheet("player", 
        "data/characters/1.png",
        { frameWidth: 32, frameHeight: 48 }
    );
    
    this.load.image("cross", "data/ui/cross.png");
    
    
    this.load.spritesheet("doriana", 
        "data/characters/doriana.png",
        { frameWidth: 32, frameHeight: 48 }
    );
    
    var keyset = new Set();
    
    this.input.keyboard.on("keydown", function(event) {
        if (!keyset.has(event.code)) {
            keyset.add(event.code);
            if (Game.keyDown)
                Game.keyDown(event.code);
        }
    });
    
    this.input.keyboard.on("keyup", function(event) {
        keyset.delete(event.code);
        if (Game.keyUp)
            Game.keyUp(event.code);
    });
    
    Game.keyPressed = function(code) {
        return keyset.has(code);
    }
}

Game.tileSize = 32;

Game.create = function()
{
    this.input.on('pointerup', Game.handleClick);
    
    Game.camera = this.cameras.main;
    
    Game.map = this.add.tilemap("map1");
    
	var village1 = Game.map.addTilesetImage("village1", "village1");
    
	Game.backgroundLayer = Game.map.createStaticLayer("background", village1);
    Game.backgroundLayer.setDepth(-3);
    
    Game.scenery1Layer = Game.map.createStaticLayer("scenery", village1);
    Game.scenery1Layer.setDepth(-2);
    
    Game.foregroundLayer = Game.map.createStaticLayer("foreground", village1);
    Game.foregroundLayer.setDepth(1000000);
    
    Game.collisionLayer = Game.map.createStaticLayer("collision", village1);
    Game.collisionLayer.visible = false;
    
    var collisionMap = [];
    for (var y = 0; y < Game.map.height; y++)
    {
        var col = [];
        for (var x = 0; x < Game.map.width; x++)
        {
            var tile = Game.collisionLayer.getTileAt(x, y);
            if (tile != null)
                col.push(1);
            else
                col.push(0);
        }
        collisionMap.push(col);
    }
    
    var npcs = Game.map.objects.filter(obj => { return obj.name === "npc" })[0].objects;
    
    for (var i = 0; i < npcs.length; i++)
    {
        var x = Math.floor(npcs[i].x / Game.tileSize);
        var y = Math.floor(npcs[i].y / Game.tileSize);
        var numTilesH = Math.floor(npcs[i].width / Game.tileSize);
        var numTilesV = Math.floor(npcs[i].height / Game.tileSize);
        
        for (var tx = x; tx < x + numTilesH; tx++)
        for (var ty = y; ty < y + numTilesV; ty++)
        {
            collisionMap[ty][tx] = 1;
        }
        
        var c = this.add.sprite(
            x * Game.tileSize + Game.tileSize * 0.5, 
            y * Game.tileSize + Game.tileSize * 0.5, npcs[i].name);
        c.setDisplayOrigin(16, 32);
        c.depth = y;
        c.name = npcs[i].name;
        Game.mapObjects.push(c);
    }
    
    var walkDown = {
        key: "walkDown",
        frames: this.anims.generateFrameNumbers("player", {
            start: 0,
            end: 3
        }),
        repeat: -1,
        frameRate: 10
    };
    this.anims.create(walkDown);
    
    var walkLeft = {
        key: "walkLeft",
        frames: this.anims.generateFrameNumbers("player", {
            start: 4,
            end: 7
        }),
        repeat: -1,
        frameRate: 10
    };
    this.anims.create(walkLeft);

    var walkRight = {
        key: "walkRight",
        frames: this.anims.generateFrameNumbers("player", {
            start: 8,
            end: 11
        }),
        repeat: -1,
        frameRate: 10
    };
    this.anims.create(walkRight);
    
    var walkUp = {
        key: "walkUp",
        frames: this.anims.generateFrameNumbers("player", {
            start: 12,
            end: 15
        }),
        repeat: -1,
        frameRate: 10
    };
    this.anims.create(walkUp);
    
    Game.player = this.add.sprite(Game.tileSize * 0.5, Game.tileSize * 0.5, "player");
    Game.player.setDisplayOrigin(16, 32);
    Game.player.depth = 0;
    Game.player.anims.play("walkDown");
    Game.player.anims.stop();
    
    Game.cross = this.add.sprite(0, 0, "cross");
    Game.cross.depth = -1;
    Game.cross.visible = false;
    
    Game.pathFinder = new EasyStar.js();
    Game.pathFinder.setGrid(collisionMap);
    Game.pathFinder.setAcceptableTiles([0]);
}

Game.handleClick = function(pointer)
{
    var x = clamp(Game.camera.scrollX + pointer.x, 0, 10000);
    var y = clamp(Game.camera.scrollY + pointer.y, 0, 10000);

    var obj = getObjectAt(x, y);
    
    if (obj)
    {
        if (playerIsCloseToObject(obj))
        {
            playerInteractWithObject(obj);
        }
    }
    else
    {
        playerGoTo(x, y);
    }
};

function playerGoTo(x, y)
{
    var toX = Math.floor(x / Game.tileSize);
    var toY = Math.floor(y / Game.tileSize);
    var fromX = Math.floor(Game.player.x / Game.tileSize);
    var fromY = Math.floor(Game.player.y / Game.tileSize);
    
    if (Game.tlPlayerMove)
    {
        Game.tlPlayerMove.stop();
        Game.tlPlayerMove.destroy();
    }
        
    Game.cross.x = toX * Game.tileSize + Game.tileSize * 0.5;
    Game.cross.y = toY * Game.tileSize + Game.tileSize * 0.5;
    Game.cross.visible = true;

    Game.pathFinder.findPath(fromX, fromY, toX, toY, function(path) {
        if (path === null) {
            console.warn("Path was not found.");
            Game.player.anims.stop();
            Game.cross.visible = false;
        } else {
            Game.moveCharacter(path);
        }
    });
        
    Game.pathFinder.calculate();
}

function playerInteractWithObject(obj)
{   
    if (objectIsCitizen(obj))
    {
        console.log("Citizen " + obj.name);
        playerStartDialogWith(obj);
    }
    else if (objectIsEnemy(obj))
    {
        console.log("Enemy " + obj.name);
        playerStartBattleWith(obj);
    }
}

function playerStartDialogWith(obj)
{
    dialog.style.visibility = "visible";
    TweenMax.fromTo("#dialog_container", 0.3, {scaleY: 0, autoAlpha: 0}, {scaleY: 1, autoAlpha: 0.75, ease: Back.easeOut});
}

function playerStartBattleWith(obj)
{

}

function objectIsCitizen(obj)
{
    return Game.citizens.includes(obj.name);
}

function objectIsEnemy(obj)
{
    return Game.enemies.includes(obj.name);
}

function playerIsCloseToObject(obj)
{
    return playerIsCloseTo(obj.x, obj.y);
}

function playerIsCloseTo(x, y)
{
    var tileX = Math.floor(x / Game.tileSize);
    var tileY = Math.floor(y / Game.tileSize);
    var playerTileX = Math.floor(Game.player.x / Game.tileSize);
    var playerTileY = Math.floor(Game.player.y / Game.tileSize);    
    return (playerTileX >= tileX - 1 && playerTileX <= tileX + 1 &&
            playerTileY >= tileY - 1 && playerTileY <= tileY + 1)
}

function getObjectAt(x, y)
{
    var toX = Math.floor(x / Game.tileSize);
    var toY = Math.floor(y / Game.tileSize);
    var tileX = Math.floor(toX * Game.tileSize + Game.tileSize * 0.5);
    var tileY = Math.floor(toY * Game.tileSize + Game.tileSize * 0.5);
    var obj = null;
    for (var i = 0; i < Game.mapObjects.length; i++)
    {
        var o = Game.mapObjects[i];
        if (tileX == o.x && tileY == o.y)
        {
            clickedMapObject = true;
            obj = o;
        }
    }
    return obj;
}

function sqr(val)
{
    return val * val;
}

function clamp(num, min, max)
{
    return num <= min ? min : num >= max ? max : num;
}

Game.moveCharacter = function(path)
{
    var tweens = [];
    for(var i = 0; i < path.length-1; i++)
    {        
        var px = path[i].x;
        var py = path[i].y;
        
        var tx = path[i+1].x;
        var ty = path[i+1].y;

        tweens.push({
            targets: Game.player,
            x: {value: Game.tileSize * 0.5 + tx * Game.tileSize, duration: 200},
            y: {value: Game.tileSize * 0.5 + ty * Game.tileSize, duration: 200},
            onStart: function(tween, object, dx, dy) {
                if (dx == "0" && dy == "1") Game.player.anims.play("walkDown");
                else if (dx == "0" && dy == "-1") Game.player.anims.play("walkUp");
                else if (dx == "1" && dy == "0") Game.player.anims.play("walkRight");
                else if (dx == "-1" && dy == "0") Game.player.anims.play("walkLeft");
            },
            onStartParams: [tx - px, ty - py]
        });
    }

    Game.tlPlayerMove = Game.scene.tweens.timeline({
        tweens: tweens,
        onComplete: function() {
            Game.player.anims.stop();
            Game.cross.visible = false;
        }
    });
};

Game.update = function(time, delta)
{
    Game.camera.scrollX = Game.player.x - 400;
    Game.camera.scrollY = Game.player.y - 300;
    Game.camera.scrollX = clamp(Game.camera.scrollX, 0, Game.map.widthInPixels - 800);
    Game.camera.scrollY = clamp(Game.camera.scrollY, 0, Game.map.heightInPixels - 600);
    
    Game.player.depth = Math.floor(Game.player.y / Game.tileSize);
    
    if (Game.keyPressed("ArrowRight"))
        Game.playerProps.xp += 1;

    updatePlayerProps();
}

Game.keyDown = function(code)
{
    console.log(code);
}

function updatePlayerProps()
{
    Game.playerProps.level = Math.floor((Math.sqrt(100 * (2 * Game.playerProps.xp + 25)) + 50) / 100);
    Game.playerProps.xpToNextLevel = (sqr(((Game.playerProps.level + 1) * 100) - 50) / 100 - 25) * 0.5;
    var xpCurLevel = (sqr((Game.playerProps.level * 100) - 50) / 100 - 25) * 0.5;
    var val = ((Game.playerProps.xp - xpCurLevel) / (Game.playerProps.xpToNextLevel - xpCurLevel));
    val *= 100;
    var circle = document.getElementById("xp_bar_progress");
    var r = 25;
    var circumf = 2 * r * Math.PI;
    var percentV = (val / 100) * circumf;
    circle.style.strokeDasharray = percentV + " " + circumf;
    
    var playerLevel = document.getElementById("player_level");
    playerLevel.innerHTML = Game.playerProps.level;
    
    var playerXp = document.getElementById("player_xp");
    playerXp.innerHTML = "XP: " + Game.playerProps.xp + " / " + Game.playerProps.xpToNextLevel;
}

var config = 
{
    type: Phaser.CANVAS,
    width: 800,
    height: 600,
    parent: "canvas_container",
    backgroundColor: "#73b857",
    pixelArt: true,
    scene: [Game]
};

var game = new Phaser.Game(config);

var dialog = document.getElementById("dialog_container");
//TweenMax.set("#dialog_container", 0.5, {scaleX: 0});

dialog.onclick = function(e) {
    TweenMax.fromTo("#dialog_container", 0.3, {scaleY: 1, autoAlpha: 0.75}, {scaleY: 0, autoAlpha: 0, ease: Quad.easeOut, onComplete: function() {dialog.style.visibility = "hidden";} });
};
