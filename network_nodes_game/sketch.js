/*
TODO: If I really wanted to be fancy, attaching nodes together would affect their
      movement. I'd need to get the sum of all forces distributed over a graph
      to make that work properly though.

      Attaching more nodes could increase the speed. - DONE

      Make score a product of the global speed and number of connected nodes. That way
      the score for different seeds is comparable. - DONE

      Put instructions in overlay over the game board, along with the controls.
      Save space, make sure they read before play. - DONE

      Add some eye candy animation to the nodes. Make them pulse or something, have some
      visual effects when they are connected to another node. Maybe a visual when they
      are about to snap a connection.

      Add in some subtle sound effects when nodes are connected and when connections snap.
*/
// object containers
var points = {};
var connectors = {};

// global settings
var max_conns = 5;
var sticky_distance = 250;
var speed = 0.5;
var pointsize = 30.0;
var lineweight = 5.0;
var node_size = 30;
var cells = 20;
var max_time = 30;
var canvas_width = 600;
var canvas_height = 600;
var speed_mod = 0; // modifier to add to the speed as more nodes get connected
var speed_increase = 2; // how much to boost the speed by as a maximum
var difficulty = 0.5; // modifier to the global speed increase as well as the score
var difficulty_factor = 5; // multiplier for difficulty

// animation stuff
var max_move = 0.25;

// internal game settings
var bg_colour = [203, .27, .77];
var bg_timeout = [0, 0.38, .8];
var num_points;
var level_seed = 0;
var time_left = max_time;
var lastClicked = -1;
var game_over = false;
var game_started = false;

// Timing
var start_time;

// --------- Classes -----------

class NetworkNode {
  constructor(x, y, conns, sticky, id) {
    this.x = x;
    this.y = y;
    this.xvec = random(-max_move, max_move);
    this.yvec = random(-max_move, max_move);
    this.sticky = sticky;
    this.max_conns = conns;
    this.connections = [];
    this.id = id;
    this.stroke_colour = (0, 0, 0);
    this.node_size = 5 + pointsize * (sticky / (2 * sticky_distance));
    this.selected = false;
  }

  add_connection(connector) {
    this.connections.push(connector);
  }

  break_connection(connector) {
    let pos = this.connections.indexOf(connector);
    if (pos != -1) {
      this.connections.splice(pos, 1);
    }
  }

  conns() {
    return this.connections.length;
  }

  move_me() {
    // modify the speed based on the current amount of nodes connected
    this.x += this.xvec * (speed_mod * speed_increase * difficulty + 1);
    this.y += this.yvec * (speed_mod * speed_increase * difficulty + 1);
    if (this.x <= this.node_size/2 || this.x >= (width-this.node_size/2)) {
      this.xvec *= -1;
    }
    if (this.y <= (this.node_size/2 + 20) || this.y >= (height-this.node_size/2)) {
      this.yvec *= -1;
    }
  }

  draw_me() {
    push();
    if (this.selected) {
      stroke(0, 0, 1);
      noFill();
      strokeWeight(0.5);
      circle(this.x, this.y, this.sticky);
      strokeWeight(3);
    } else {
      strokeWeight(1);
    }
    stroke(0);
    if (this.max_conns > this.conns()) {
      fill(30, .88, .84);
    } else {
      fill(155, .88, .84);
    }
    circle(this.x, this.y, this.node_size);
    fill(0);
    textAlign(CENTER, CENTER);
    strokeWeight(1);
    text(this.max_conns-this.connections.length, this.x, this.y);
    pop()
  }

  was_clicked(mx, my) {
    let v1 = new p5.Vector(mx, my);
    let v2 = new p5.Vector(this.x, this.y);
    return v1.dist(v2) <= this.node_size/2;
  }

  click() {
    this.selected = !this.selected;
  }

  can_connect(n) {
    let d = new p5.Vector(this.x, this.y).dist(new p5.Vector(n.x, n.y));
    return this.conns() < this.max_conns && n.conns() < n.max_conns && d < this.sticky/2 && this.connections.indexOf(n) == -1;
  }
}

class Connector {
  constructor(n) {
    this.endpoints = n;
    let ids = [parseInt(n[0].id), parseInt(n[1].id)].sort(function(a, b){return a - b});
    this.id = ids[0] + "_" + ids[1];
  }

  draw_me() {
    let end1 = [this.endpoints[0].x, this.endpoints[0].y];
    let end2 = [this.endpoints[1].x, this.endpoints[1].y];
    let p = 1.0 - this.get_length() / ((this.endpoints[0].sticky + this.endpoints[1].sticky)/2.0);
    push()
    stroke(0, 1, 1-p);
    strokeWeight(lineweight * p);
    line(end1[0], end1[1], end2[0], end2[1]);
    pop()
  }

  get_ends() {
    return [this.endpoints[0].x, this.endpoints[0].y, this.endpoints[1].x, this.endpoints[1].y];
  }

  get_length() {
    let end1 = new p5.Vector(this.endpoints[0].x, this.endpoints[0].y);
    let end2 = new p5.Vector(this.endpoints[1].x, this.endpoints[1].y);
    return end1.dist(end2);
  }

  disconnect() {
    this.endpoints[0].break_connection(this);
    this.endpoints[1].break_connection(this);
  }

  check_for_break() {
    let stickies = [this.endpoints[0].sticky, this.endpoints[1].sticky];
    stickies.sort(function(a, b){return a - b});
    return this.get_length() > stickies[0];
  }
}

function intersect(x1, y1, x2, y2, x3, y3, x4, y4, drawIntersect=false) {
  // short circuit if any lines share an end point, since it
  // technically intersects, but actually doesn't for our purposes
  if ((x1 == x3 && y1 == y3) || (x1 == x4 && y1 == y4) || (x2 == x3 && y2 == y3) || (x2 == x4 && y2 == y4)) {
    return false;
  }
  let x12 = x1 - x2;
  let x34 = x3 - x4;
  let y12 = y1 - y2;
  let y34 = y3 - y4;
  let c = x12 * y34 - y12 * x34;
  let a = x1 * y2 - y1 * x2;
  let b = x3 * y4 - y3 * x4;
  if (c != 0) {
    let xi = (a * x34 - b * x12) / c;
    let yi = (a * y34 - b * y12) / c;
    // check for projected intersections
    if ((xi < x1 && xi < x2) || (xi > x1 && xi > x2) || (yi < y1 && yi < y2) || (yi > y1 && yi > y2)) {
      return false;
    }
    if ((xi < x3 && xi < x4) || (xi > x3 && xi > x4) || (yi < y3 && yi < y4) || (yi > y3 && yi > y4)) {
      return false;
    }
    // draw an intersection circle
    if (drawIntersect) {
      push();
      noStroke();
      fill(0, 1, 1);
      circle(xi, yi, 5);
      pop();
    }
    return true;
  } else {
    return false;
  }
}

function get_score() {
  let current = 0;
  let possible = 0
  for (p in points) {
    current += points[p].connections.length;
    possible += points[p].max_conns;
  }
  return [current, possible];
}

function store_score(score, seed) {
  let highscore = localStorage.getItem(seed);
  let myscore = Math.trunc(parseInt(score) * difficulty * 10)
  if (highscore == null || myscore > parseInt(highscore)) {
    localStorage.setItem(seed, myscore);
  }
}

function get_highscore(seed) {
  return localStorage.getItem(seed);
}

function update_difficulty() {
  let diff_label = document.getElementById("difficulty_label");
  let diff_amount = document.getElementById("difficulty_slider").value;
  diff_label.innerHTML = diff_amount;
}

function start_game() {
  let dtime = new Date();
  start_time = dtime.getTime();
  game_started = true;
  game_over = false;
  difficulty = document.getElementById("difficulty_slider").value / 100 * difficulty_factor;
  document.getElementById("difficulty_label").innerHTML = document.getElementById("difficulty_slider").value;
  document.getElementById("controls").style.display = "none";
  document.getElementById("scores").style.display = "none";

  // get rid of connectors!
  for (c in connectors) {
    connectors[c].disconnect();
    delete connectors[c];
  }
}

function show_controls() {
  populate_highscores();
  document.getElementById("controls").style.display = "inline-block";
  document.getElementById("scores").style.display = "block";
  
}

// Set up a new game
function setup_board(refresh=false) {
  if (refresh == false) {
    // generating a new seed, not getting one from the
    // user
    level_seed = Math.trunc(random(10000));
  }
  randomSeed(level_seed);
  points = {};
  connectors = {};
  // game state
  game_over = false;
  game_started = false;
  // set up the HTML UI
  document.getElementById("seed_field").value = level_seed;

  num_points = 10 + Math.trunc(random(30));

  // populate points
  let xcellsize = width/cells;
  let ycellsize = height/cells;
  let coords = [];
  for (let x=0; x<cells; x++) {
    for (let y=1; y<cells-1; y++) {
      coords.push([x * xcellsize + xcellsize/2, y * ycellsize + ycellsize/2]);
    }
  }
  
  let i = 0;
  let np = num_points;
  while (np > 0 && coords.length > 0) {
    let pos = Math.trunc(random(coords.length));
    let x = coords[pos][0];
    let y = coords[pos][1];
    coords.splice(pos,1);
    let s = sticky_distance + random(sticky_distance);
    let cons = Math.trunc(random(max_conns))+1;

    points[i] = new NetworkNode(x, y, cons, s, i);

    np -= 1;
    i += 1;
  }
}

function setup() {
  // put setup code here
  createCanvas(canvas_width, canvas_height);
  colorMode(HSB, 360, 1, 1, 1);
  background(...bg_colour);
  frameRate(30);

  setup_board();

  // set the difficulty to 50
  document.getElementById("difficulty_slider").value = 50;
}

function draw() {
  // recalculate the speed modifier
  let current_score = get_score();
  speed_mod = current_score[0] / current_score[1];

  // change the background to red if the game is over
  // and only move the points if the game is running
  if (game_over == true) {
    background(...bg_timeout);
  } else {
    background(...bg_colour);
    if (game_started) {
      for (p in points) {
        points[p].move_me();
      }
    }
  }

  // Check to see if any connecting lines intersect, and break all intersecting
  // lines if so
  let breaks = new Set();
  for (i in connectors) {
    if (connectors[i].check_for_break()) {
      breaks.add(i);
    }
    for (j in connectors) {
      let ends = connectors[i].get_ends().concat(connectors[j].get_ends())
      if (intersect(...ends)) {
        breaks.add(i);
        breaks.add(j);
      }
    }
  }
  // now clean up any breaks from the connectors list
  let b = Array.from(breaks).sort(function(a, b){return a - b});
  b.reverse();
  for (i in b) {
      connectors[b[i]].disconnect();
      delete connectors[b[i]];
  }

  // draw the radius and connection line if a node is selected
  if (lastClicked != -1) {
    push();
    stroke(0, 0, 1);
    strokeWeight(0.5);
    let p1 = new p5.Vector(mouseX - points[lastClicked].x, mouseY - points[lastClicked].y);
    let d = p1.mag();
    let mx;
    let my;
    if (d <= points[lastClicked].sticky/2) {
      mx = mouseX;
      my = mouseY;
    } else {
      let hv = p1.heading();
      mx = Math.cos(hv) * points[lastClicked].sticky/2 + points[lastClicked].x;
      my = Math.sin(hv) * points[lastClicked].sticky/2 + points[lastClicked].y;
    }
    line(points[lastClicked].x, points[lastClicked].y, mx, my);
    pop();
    for (c in connectors) {
      let ends = connectors[c].get_ends().concat([mx, my, points[lastClicked].x, points[lastClicked].y])
      intersect(...ends, drawIntersect=true);
    }
  }

  // draw the lines and nodes
  for (i in connectors) {
    connectors[i].draw_me();
  }
  for (i in points) {
    points[i].draw_me();
  }

  // draw the current score, seed, and time
  push();
  fill(0);
  textSize(20);
  let score = get_score();
  textAlign(LEFT);
  let myscore = Math.trunc(score[0] * difficulty * 10)
  //text(score[0] + " of " + score[1] + "["+myscore+"]", 10, 20);
  text("Score: "+myscore, 10, 20);
  textAlign(CENTER);
  text("Seed "+level_seed, width/2, 20);

  if (game_over == false && game_started == true) {
    let dt = new Date().getTime();
    time_left = max_time - ((dt/1000)-(start_time/1000));
    if (time_left < 0.01) {
      game_over = true;
      game_started = false;
      time_left = 0;
      show_controls();
      // try and store the current score
      store_score(get_score()[0], level_seed);
      populate_highscores(); // update the table of highscores
      for (i in points) {
        points[i].selected = false;
      }
      lastClicked = -1;
    }
  }

  if (game_over == true) {
    // draw a rect in the middle of the screen for signage
    fill(0, 0, 1);
    stroke(0);
    strokeWeight(3);
    
    // show your score
    let highscore = get_highscore(level_seed);
    let myscore = Math.trunc(get_score()[0] * difficulty * 10)
    if (highscore == null) {
      highscore = get_score()[0];
    }
    if (myscore >= highscore) {
      fill(91, 1, .72);
    }
    rect(100, 200, width-200, height-300);
    strokeWeight(1);
    fill(200, 0.5, 0.5);
    textSize(30);
    textAlign(CENTER);
    
    let textpos = 300;
    if (myscore >= highscore) {
      text("NEW HIGHSCORE!", width/2, textpos);
    }
    text("Your score: "+myscore, width/2, textpos+50);
    text("Best score: "+highscore, width/2, textpos+100);
    // show high score
    fill(0, .96, .46);
  } else {
    fill(0);
  }
  strokeWeight(1);
  textSize(20);
  textAlign(RIGHT);
  text(Math.round(time_left)+" seconds", width-10, 20);
  pop();
}

function mouseClicked() {
  if (game_over == true || game_started == false) {
    return
  }

  let clicked = -1;
  for (p in points) {
    if (points[p].was_clicked(mouseX, mouseY)) {
      clicked = p;
      break;
    }
  }

  if (clicked == -1 && lastClicked != -1) {
    points[lastClicked].click();
    lastClicked = -1;
  } else if (clicked != -1 && clicked == lastClicked) {
    // deselect the current node
    points[clicked].click();
    lastClicked = -1;
  } else if (clicked != -1 && lastClicked == -1) {
    // selected a new node
    points[clicked].click();
    lastClicked = clicked;
  } else if (clicked != -1) {
    // trying to join a selected node to a new one
    let ids = [lastClicked, clicked].sort(function(a, b){return a - b});
    let cid = ids[0]+"_"+ids[1];
    if (connectors.hasOwnProperty(cid)) {
      connectors[cid].disconnect();
      delete connectors[cid];
      points[lastClicked].selected = false;
      points[clicked].selected = false;
      lastClicked = -1;
    } else if (points[lastClicked].can_connect(points[clicked])) {
      let c = new Connector([points[lastClicked], points[clicked]]);
      let breaks = new Set();
      let ends = c.get_ends();
      for (i in connectors) {
        let l_ends = connectors[i].get_ends().concat(ends);
        if (intersect(...l_ends)) {
          breaks.add(i);
        }
      }
      let b = Array.from(breaks).sort(function(a, b){return a - b});
      b.reverse();
      for (i in b) {
        connectors[b[i]].disconnect();
        delete connectors[b[i]];
      }
      connectors[c.id] = c;
      points[lastClicked].add_connection(c);
      points[clicked].add_connection(c);

      points[lastClicked].click();
      lastClicked = -1;
    } else {
      // leaving this in case I want to play an animation when you click
      // on space rather than a node
    }
  }
}

function update_seed(val=-1) {
  if (game_started) {
    return;
  }
  let sf;
  if (val == -1){
    sf = document.getElementById("seed_field").value;
  } else {
    sf = val;
  }
  // make sure we have a number, otherwise regen a random
  // seed
  if (isNaN(sf)) {
    sf = Math.trunc(random(0, 10000));
  }
  // just in case a float is entered
  sf = Math.trunc(sf);
  // bounds check
  if (sf > 10000) {
    sf = 10000;
  } else if (sf < 0) {
    sf = 0;
  }
  level_seed = sf;
  setup_board(refresh=true);
}

function remove_seed(s) {
  // remove seed s from the highscore list
  if (game_started) {
    return;
  }
  localStorage.removeItem(s);
  populate_highscores();
}

function populate_highscores() {
  let highscore_table = document.getElementById("highscores");
  let seeds = [];
  let t = "<table id='highscore_table'><tr><th>Seed</th><th>Score</th><th>Delete</th></tr>";
  for (let key in localStorage) {
    if (!isNaN(key)) {
      seeds.push(key);
    }
  }
  for (s in seeds.sort(function(a, b){return parseInt(a) - parseInt(b)})) {
    t += "<tr><td><a href='#' onclick='update_seed(val="+seeds[s]+");'><div>"+seeds[s]+"</div></a></td><td>"+localStorage.getItem(seeds[s])+"</td><td style='text-align:center;'><a href='#' onclick='remove_seed("+seeds[s]+");'><div>X</div></a></td></tr>";
  }
  t += "</table>";
  //console.log(t);
  highscore_table.innerHTML = t;
}