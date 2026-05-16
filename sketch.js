let video;
let bodyPose;
let poses = [];
let faceMesh;
let faces = [];
let options = { maxFaces: 1, refineLandmarks: false, flipHorizontal: false };

let showScore = false;
let scoreResult = "";
let scoreIsPositive = false;

let selectedKeypointIndices = [];
let pointValues = [];
let pointSizes = [];
let lastRefreshTime = 0;
const REFRESH_INTERVAL = 8000;

let selectedBodyIndices = [];
let bodyPointValues = [];
let bodyPointSizes = [];
let lastBodyRefresh = 0;

let activePanel = null;

let allMetrics = [
  "bridge width", "tip angle", "symmetry", "lid droop", "iris clarity",
  "arch height", "density", "volume", "texture", "flush index",
  "cupid bow", "fullness", "projection", "hydration", "sheen",
  "glabellar line", "jawline", "definition", "skin tone", "corner lift"
];

function preload() {
  bodyPose = ml5.bodyPose("BlazePose");
  faceMesh = ml5.faceMesh(options);
}

function setup() {
  createCanvas(640, 480);
textFont("receipt-narrow");
  
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();
  bodyPose.detectStart(video, gotPoses);
  faceMesh.detectStart(video, gotFaces);
}

function buildPanel(x, y, rawX, rawY) {
  let shuffled = [...allMetrics].sort(() => random() - 0.5);
  let points = shuffled.slice(0, 3).map((label) => {
    let sign = random() > 0.5 ? "+" : "-";
    let val = floor(random(1, 101));
    return { label, value: sign + val, positive: sign === "+" };
  });
  return { x, y, rawX, rawY, points };
}

function mousePressed() {
  if (dist(mouseX, mouseY, 600, 45) < 30) {
    showScore = !showScore;
    if (showScore) {
      scoreIsPositive = random() > 0.5;
      scoreResult = scoreIsPositive
        ? "congrats! you are BEAUTIFUL!\nyou have worth!"
        : "OH NO! you are UGLY!\nclick HERE for tips on how\nto improve your features\nand become beautiful.";
    }
    return;
  }

  if (showScore) {
    showScore = false;
    return;
  }

  if (faces.length > 0) {
    let face = faces[0];
    for (let j = 0; j < selectedKeypointIndices.length; j++) {
      let kp = face.keypoints[selectedKeypointIndices[j]];
      if (!kp) continue;
      let kpX = width - kp.x;
      let kpY = kp.y;
      if (dist(mouseX, mouseY, kpX, kpY) < 30) {
        if (activePanel && abs(activePanel.x - kpX) < 5 && abs(activePanel.y - kpY) < 5) {
          activePanel = null;
        } else {
          activePanel = buildPanel(kpX, kpY, kp.x, kp.y);
        }
        return;
      }
    }
  }
  activePanel = null;
}

function refreshFacePoints(totalKeypoints) {
  selectedKeypointIndices = [];
  pointValues = [];
  pointSizes = [];
  let available = Array.from({ length: totalKeypoints }, (_, i) => i);
  for (let i = 0; i < 10 && available.length > 0; i++) {
    let randIdx = floor(random(available.length));
    selectedKeypointIndices.push(available[randIdx]);
    available.splice(randIdx, 1);
    let sign = random() > 0.5 ? "+" : "-";
    pointValues.push(sign + floor(random(1, 101)));
    pointSizes.push(random(10, 25));
  }
  lastRefreshTime = millis();
}

function refreshBodyPoints(totalKeypoints) {
  selectedBodyIndices = [];
  bodyPointValues = [];
  bodyPointSizes = [];
  let available = Array.from({ length: totalKeypoints }, (_, i) => i).slice(11);
  for (let i = 0; i < 10 && available.length > 0; i++) {
    let randIdx = floor(random(available.length));
    selectedBodyIndices.push(available[randIdx]);
    available.splice(randIdx, 1);
    bodyPointValues.push((random() > 0.5 ? "+" : "-") + floor(random(1, 101)));
    bodyPointSizes.push(random(10, 20));
  }
  lastBodyRefresh = millis();
}

function drawZoomedPreview(px, py, previewW, previewH, rawX, rawY) {
  let cropSize = 60;
  let srcX = constrain(rawX - cropSize / 2, 0, video.width - cropSize);
  let srcY = constrain(rawY - cropSize / 2, 0, video.height - cropSize);

  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(px + 1, py + 1, previewW - 2, previewH - 2);
  drawingContext.clip();

  push();
  translate(px + previewW, py);
  scale(-1, 1);
  image(video, 0, 0, previewW, previewH, srcX, srcY, cropSize, cropSize);
  pop();

  drawingContext.restore();
}

function drawScoreButton() {
  fill(255,255,255,100);
  stroke(0);
  strokeWeight(3);
  circle(590, 50, 74);
  fill("#000000");
  noStroke();
  textSize(10);
  textStyle(BOLD);
  textAlign(CENTER, CENTER);
  text("CLICK FOR\nYOUR\nBEAUTY\nSCORE", 590, 50);
}

function draw() {
  // video — no zoom, just mirrored
  push();
  translate(640, 0);
  scale(-1, 1);
  image(video, 0, 0, 640, 480);
  pop();

  // dark overlay
  fill(5, 5, 5, 130);
  noStroke();
  rect(0, 0, 640, 480);

  // body points
  for (let i = 0; i < poses.length; i++) {
    let pose = poses[i];
    if (selectedBodyIndices.length === 0 || millis() - lastBodyRefresh > REFRESH_INTERVAL) {
      refreshBodyPoints(pose.keypoints.length);
    }
    for (let j = 0; j < selectedBodyIndices.length; j++) {
      let kp = pose.keypoints[selectedBodyIndices[j]];
      if (!kp || kp.confidence < 0.2) continue;
      let isPositive = bodyPointValues[j].startsWith("+");
      fill(isPositive ? "#08A300" : "#C40015");
      noStroke();
      textSize(bodyPointSizes[j] || 20);
      textStyle(BOLD);
      textAlign(CENTER, CENTER);
      text(bodyPointValues[j], 640 - kp.x, kp.y);
    }
  }

  // breast midpoints
  // if (poses.length > 0) {
  //   let pose = poses[0];
  //   let lS = pose.left_shoulder, lH = pose.left_hip;
  //   let rS = pose.right_shoulder, rH = pose.right_hip;
  //   if (lS && lH && rS && rH) {
  //     fill("#DBB800");
  //     noStroke();
  //     textSize(40);
  //     textAlign(CENTER, CENTER);
  //     let t = 0.25;
  //     let lX = 640 - lerp(lerp(lS.x, rS.x, 0.3), lH.x, t);
  //     let lY = lerp(lS.y, lH.y, t);
  //     let rX = 640 - lerp(lerp(rS.x, lS.x, 0.3), rH.x, t);
  //     let rY = lerp(rS.y, rH.y, t);
  //     text("TITS", lX, lY);
  //     text("TITS", rX, rY);
  //   }
  // }

  // face scatter points
  for (let i = 0; i < faces.length; i++) {
    let face = faces[i];
    if (selectedKeypointIndices.length === 0 || millis() - lastRefreshTime > REFRESH_INTERVAL) {
      refreshFacePoints(face.keypoints.length);
    }
    for (let j = 0; j < selectedKeypointIndices.length; j++) {
      let kp = face.keypoints[selectedKeypointIndices[j]];
      if (!kp) continue;
      let kpX = width - kp.x;
      let kpY = kp.y;
      let isPositive = pointValues[j].startsWith("+");

      if (activePanel && abs(activePanel.x - kpX) < 40 && abs(activePanel.y - kpY) < 40) {
        noFill();
        stroke(255, 255, 255, 80);
        strokeWeight(1);
        circle(kpX, kpY, 28);
      }

      fill(isPositive ? "#08A300" : "#C40015");
      noStroke();
      textSize(pointSizes[j] || 15);
      textStyle(BOLD);
      textAlign(CENTER, CENTER);
      text(pointValues[j], kpX, kpY);
    }
  }

  // analysis panel
  if (activePanel) {
    let r = activePanel;
    let pw = 320;
    let previewW = 160;
    let metricsX = previewW + 8;
    let ph = 120;

    let px = constrain(r.x - pw / 2, 10, 640 - pw - 10);
    let py = constrain(r.y - ph - 20, 10, 480 - ph - 10);

    let positiveCount = r.points.filter(p => p.positive).length;
    let isNetPos = positiveCount >= r.points.length / 2;
    let borderHex = isNetPos ? "#08A300" : "#C40015";

    fill(5, 5, 10, 150);
    stroke(borderHex);
    strokeWeight(1.5);
    rect(px, py, pw, ph, 4);

    drawZoomedPreview(px, py, previewW, ph, r.rawX, r.rawY);

    stroke(60, 60, 60, 150);
    strokeWeight(0.5);
    line(px + previewW, py + 6, px + previewW, py + ph - 6);

    let rowH = ph / 3;
    for (let k = 0; k < r.points.length; k++) {
      let pt = r.points[k];
      let rowY = py + k * rowH;

      noStroke();
      fill("#A0A0A0");
      textSize(10);
      textStyle(NORMAL);
      textAlign(LEFT, CENTER);
      text(pt.label, px + metricsX + 4, rowY + rowH / 2);

      fill(pt.positive ? "#08C800" : "#DC001E");
      textSize(13);
      textStyle(BOLD);
      textAlign(RIGHT, CENTER);
      text(pt.value, px + pw - 8, rowY + rowH / 2);

      if (k < r.points.length - 1) {
        stroke(50, 50, 50, 100);
        strokeWeight(0.5);
        line(px + metricsX + 4, rowY + rowH, px + pw - 6, rowY + rowH);
      }
    }

    stroke(borderHex);
    strokeWeight(1);
    noFill();
    drawingContext.setLineDash([4, 4]);
    line(px + pw / 2, py + ph, r.x, r.y);
    drawingContext.setLineDash([]);

    fill(borderHex);
    noStroke();
    circle(r.x, r.y, 6);
  }

  // score overlay
  if (showScore) {
    fill(0, 0, 0, 210);
    noStroke();
    rect(0, 0, 640, 480);

    fill(scoreIsPositive ? "#08A300" : "#C40015");
    textSize(32);
    textStyle(BOLD);
    textAlign(CENTER, CENTER);
    text(scoreResult, 320, 240);
  }

  drawScoreButton();
}

function gotPoses(results) { poses = results; }
function gotFaces(results) { faces = results; }