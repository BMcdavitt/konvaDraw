//  'container' is the id of the <div> displaying the konva stage

let kWidth = document.getElementById('container').clientWidth
let kHeight = document.getElementById('container').clientHeight
let isDraggableOn = false
let mobileDoubleTouch = false
let imagePath = ''
let graphDimensions = { width: defaultWidth, height: defaultHeight }
let graphVisible = true
//  gWhScaleBy is the speed in which scroll wheel will zoom
let gWhScaleBy = 1.1
let newPos = ''
let newScaleForImgGraph = 1

let brushColor = 'black'
let vBrushColor = 'green'
let brushSize = 4
let vBrushSize = 4
let eraserSize = 20
let vEraserSize = 20

let stage = new Konva.Stage({
  container: 'container',
  width: kWidth,
  height: kHeight,
})

let undo_log = []
let vShape_index = 0
let cShape_index = 0
let destroyed_nodes = []

let imageLayer = new Konva.Layer()
let graphLayer = new Konva.Layer()
let drawLayer = new Konva.Layer()
let vDrawLayer = new Konva.Layer()
let curveLayer = new Konva.Layer()
let scrollBarBackground = new Konva.Layer()
let scrollBarLayer = new Konva.Layer()
let imageObj = new Image()

let widthScale = kWidth / getWidth()
let heightScale = kHeight / getHeight()
let globalHRatio = 1
let globalWRatio = 1

let ignoreNextPoint = false

let lineHovered = false

//*********************************************************
//***                   Draw Graph                      ***
//*********************************************************

// Higher Number lowers line density
let lineScale = 2
let graphColor = '#3aa4c9'

if (graphDimensions) {
  function getLineDensity(linePos) {
    if (linePos % 10 === 0) {
      return 2.25 / lineScale
    } else if (linePos % 5 === 0) {
      return 1.5 / lineScale
    } else {
      return 0.75 / lineScale
    }
  }

  function addGraphLine(x1, y1, x2, y2, x) {
    graphLayer.add(
      new Konva.Line({
        points: [x1, y1, x2, y2],
        stroke: graphColor,
        strokeWidth: getLineDensity(x),
        lineCap: 'round',
        lineJoine: 'round',
      })
    )
  }

  //  Draw Rows

  function addGraphRow(x) {
    addGraphLine(
      0,
      x * graphScale,
      (graphDimensions.width / 4) * graphScale,
      x * graphScale,
      x
    )
  }

  function drawGraph() {
    graphScale = 4

    for (let x = 0; x < graphDimensions.height / 4; x++) {
      addGraphRow(x)
    }

    if (graphDimensions.height % 4 === 0) {
      addGraphRow(graphDimensions.height / 4)
    }

    //  Draw Columns

    function addGraphCol(x) {
      addGraphLine(
        x * graphScale,
        0,
        x * graphScale,
        (graphDimensions.height / 4) * graphScale,
        x
      )
    }

    for (let x = 0; x < graphDimensions.width / 4; x++) {
      addGraphCol(x)
    }

    if (graphDimensions.width % 4 === 0) {
      addGraphCol(graphDimensions.width)
    }
  }
  //

  drawGraph()

  stage.add(graphLayer)

  function toggleGrid(overRide) {
    if ((graphVisible || overRide === 'off') && overRide !== 'on') {
      graphVisible = false
      graphLayer.hide()
    } else {
      graphVisible = true
      graphLayer.show()
    }
  }
}
//*********************************************************
//***                   Draw Image                      ***
//*********************************************************

function displayImage(newImagePath) {
  if (newImagePath) {
    imagePath = newImagePath
    imageObj.src = newImagePath
    imageObj.onload = function () {
      let showImage = new Konva.Image({
        image: imageObj,
      })

      imageLayer.add(showImage)

      adjustSize(imageObj.height, imageObj.width)

      document.getElementById('userWidth').value = imageObj.width
      document.getElementById('userWidth').readOnly = true
      document.getElementById('userHeight').value = imageObj.height
      document.getElementById('userHeight').readOnly = true
    }

    stageReset()

    imageLayer.destroy()
    stage.add(imageLayer)
    imageLayer.moveToBottom()
    toggleGrid('off')
  }
}

function updateImageSize() {
  if (imagePath) {
    getNewContainerDimensions(imageObj.height, imageObj.width)

    stage.scaleX(globalWScale)
    stage.scaleY(globalWScale)

    updateScrollBars()
  }
}

//*********************************************************
//***                   Add Layers                      ***
//*********************************************************

stage.add(drawLayer)
stage.add(vDrawLayer)
stage.add(curveLayer)

function newStage() {
  document.getElementById('userWidth').value = defaultWidth
  document.getElementById('userHeight').value = defaultHeight
  stageReset()
  updateSize()
  toggleGrid('on')
}

function stageReset() {
  context.clearRect(0, 0, canvas.width, canvas.height)

  imageLayer.destroy()
  stage.remove(imageLayer)

  vDrawLayer.destroy()
  stage.add(vDrawLayer)

  undo_log = []

  bezShapes = []
  bezOpen = false
  bezShapeCount = 0
  currentBezShape = bezShapeCount
  bezPointCount = 0
  currentBezPoint = 0
  bezLineCount = 0
  priorBezPoint = false
  visiblePoints = false
}

//*********************************************************
//***                Draw Scroll Bars                   ***
//*********************************************************

function hScrollBarPos() {
  let currentStageWidth = (stage.width() * stage.scaleX()) / globalWScale
  let stageWidthPercentOffscreen =
    Math.abs(stage.position().x) / (currentStageWidth - stage.width())

  document.getElementById('horizontal-slider').value =
    100 * stageWidthPercentOffscreen
}

function vScrollBarPos() {
  let currentStageHeight = (stage.height() * stage.scaleY()) / globalHScale
  let stageHeightPercentOffscreen =
    Math.abs(stage.position().y) / (currentStageHeight - stage.height())

  document.getElementById('vertical-slider').value =
    100 - 100 * stageHeightPercentOffscreen
}

let vSlider = document.getElementById('vertical-slider')

vSlider.oninput = function () {
  let currentStageHeight = (stage.height() * stage.scaleY()) / globalHScale
  let topYRange = currentStageHeight - stage.height()
  let newY = topYRange * ((100 - vSlider.value) / 100)

  stage.y(newY * -1)
}

let hSlider = document.getElementById('horizontal-slider')

hSlider.oninput = function () {
  let currentStageWidth = (stage.width() * stage.scaleX()) / globalWScale
  let fullXRange = currentStageWidth - stage.width()
  let newX = fullXRange * (hSlider.value / 100)

  stage.x(newX * -1)
}

function showHidehScrollBar() {
  let hSlider = document.getElementById('horizontal-slider')
  let vSlider = document.getElementById('vertical-slider')

  if (stage.scaleX() === globalWScale) {
    hSlider.style.visibility = 'hidden'
  } else {
    hSlider.style.visibility = 'visible'
  }

  if (stage.scaleY() === globalHScale) {
    vSlider.style.visibility = 'hidden'
  } else {
    vSlider.style.visibility = 'visible'
  }
}

function updateScrollBars() {
  hScrollBarPos()
  vScrollBarPos()

  showHidehScrollBar()
}

//*********************************************************
//***   Scale up the Image/Graph to fit the container   ***
//*********************************************************

function scaleStage() {
  if (widthScale > 1 || heightScale > 1 || !imagePath) {
    newScaleForImgGraph = Math.max(widthScale, heightScale)
    stage.scale({ x: newScaleForImgGraph, y: newScaleForImgGraph })
  }
}

scaleStage()

function getWidth() {
  if (graphDimensions) {
    return graphDimensions.width
  } else if (imagePath) {
    return imageObj.width
  }
}

function getHeight() {
  if (graphDimensions) {
    return graphDimensions.height
  } else if (imagePath) {
    return imageObj.height
  }
}

//**************************************************************************************
//***  Ensures new stage postion keeps container completely filled with graph/image  ***
//**************************************************************************************

function getValidCord(pos, objectSize, containerSize) {
  let newPos = Math.min(pos, 0)

  if (newPos !== 0) {
    if (objectSize * stage.scaleX() < containerSize) {
      newPos = 0
    } else {
      newPos = Math.max(pos, containerSize + (0 - objectSize * stage.scaleX()))
    }
  }

  return newPos
}

//*********************************************************
//***   Mobile Pinch Zoom and Two Finger Drag Support   ***
//*********************************************************

function getDistance(p1, p2) {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
}

function getCenter(p1, p2) {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  }
}

let lastCenter = null
let lastDist = 0

stage.on('touchmove', function (e) {
  e.evt.preventDefault()
  let touch1 = e.evt.touches[0]
  let touch2 = e.evt.touches[1]

  let kWidth = document.getElementById('container').clientWidth
  let kHeight = document.getElementById('container').clientHeight

  if (touch1 && touch2) {
    mobileDoubleTouch = true
    if (stage.isDragging()) {
      stage.stopDrag()
    }
    movePathArray = []
    movePathDelay = 0
  }

  if (!mobileDoubleTouch) {
    return
  }

  let containerOffset = document
    .getElementById('container')
    .getBoundingClientRect()

  let p1 = {
    x: touch1.clientX - containerOffset.left,
    y: touch1.clientY - containerOffset.top,
  }
  let p2 = {
    x: touch2.clientX - containerOffset.left,
    y: touch2.clientY - containerOffset.top,
  }

  if (!lastCenter) {
    lastCenter = getCenter(p1, p2)
    return
  }
  let newCenter = getCenter(p1, p2)

  let dist = getDistance(p1, p2)

  if (!lastDist) {
    lastDist = dist
  }

  // local coordinates of center point
  let pointTo = {
    x: (newCenter.x - stage.x()) / stage.scaleX(),
    y: (newCenter.y - stage.y()) / stage.scaleX(),
  }
  let scale = stage.scaleX() * (dist / lastDist)

  if (getWidth() * scale < kWidth) {
    scale = globalWScale
  } else if (getHeight() * scale < kHeight) {
    scale = globalHScale
  }

  stage.scaleX(scale)
  stage.scaleY(scale)

  // calculate new position of the stage
  let dx = newCenter.x - lastCenter.x
  let dy = newCenter.y - lastCenter.y

  let newPos = {
    x: newCenter.x - pointTo.x * scale + dx,
    y: newCenter.y - pointTo.y * scale + dy,
  }

  newPos.x = getValidCord(newPos.x, getWidth(), kWidth)
  newPos.y = getValidCord(newPos.y, getHeight(), kHeight)

  stage.position(newPos)

  lastDist = dist
  lastCenter = newCenter

  updateScrollBars()
  updateTouchPoints()
})

stage.on('touchend', function () {
  lastDist = 0
  lastCenter = null
})

//********************************************
//***   Scroll Wheel Zoom In/Out Support   ***
//********************************************

stage.on('wheel', (e) => {
  e.evt.preventDefault()

  let kWidth = document.getElementById('container').clientWidth
  let kHeight = document.getElementById('container').clientHeight

  let whOldScale = stage.scaleX()
  let whPointer = stage.getPointerPosition()

  let whOldScaleMousePointTo = {
    x: (whPointer.x - stage.x()) / whOldScale,
    y: (whPointer.y - stage.y()) / whOldScale,
  }

  let whDirection = e.evt.deltaY > 0 ? -1 : 1

  let whNewScale =
    whDirection > 0 ? whOldScale * gWhScaleBy : whOldScale / gWhScaleBy

  //  Keep the container filled with the graph or image
  if (getWidth() * whNewScale < kWidth && whDirection < 0) {
    whNewScale = widthScale
  } else if (getHeight() * whNewScale < kHeight && whDirection < 0) {
    whNewScale = heightScale
  }

  stage.scale({ x: whNewScale, y: whNewScale })

  let whNewPos = {
    x: whPointer.x - whOldScaleMousePointTo.x * whNewScale,
    y: whPointer.y - whOldScaleMousePointTo.y * whNewScale,
  }

  whNewPos.x = getValidCord(whNewPos.x, getWidth(), kWidth)
  whNewPos.y = getValidCord(whNewPos.y, getHeight(), kHeight)

  stage.absolutePosition(whNewPos)

  updateScrollBars()
  updateTouchPoints()
})

//********************************************
//***       Support for drawing         ***
//********************************************
let canvas = document.createElement('canvas')

canvas.width = getWidth()
canvas.height = getHeight()

let image = ''
let context = ''
let isPaint = false
let lastPointerPosition = ''
//  edit movePathDelayCount to adjust, this prevents accidental marks when pinch zooming
let movePathDelayCount = 5
let movePathArray = []
let vMovePathArray = []
let movePathDelay = 0

let vLastLine = ''
let cLastLine = ''

initializeDrawLayer()

function initializeDrawLayer() {
  image = new Konva.Image({
    image: canvas,
    x: 0,
    y: 0,
  })
  drawLayer.add(image)

  context = canvas.getContext('2d')
  context.strokeStyle = brushColor
  context.lineJoin = 'round'
  context.lineWidth = brushSizes()
}

function brushSizes() {
  return globalCompisteOperation() === 'destination-out'
    ? eraserSize
    : brushSize
}

function vBrushSizes() {
  return globalCompisteOperation() === 'destination-out'
    ? vEraserSize
    : vBrushSize
}

function pencilType() {
  return document.getElementById('pencilSelect').value
}

function globalCompisteOperation() {
  return document.getElementById('eraserSelect').value === 'On'
    ? 'destination-out'
    : 'source-over'
}

stage.on('mousedown touchstart', function () {
  if (mobileDoubleTouch || lineHovered) {
    return
  }

  if (pencilType() === 'pencil vector') {
    isPaint = true

    let next_id = 'vline_' + vShape_index
    vLastLine = new Konva.Line({
      stroke: vBrushColor,
      strokeWidth: vBrushSizes(),
      globalCompositeOperation: globalCompisteOperation(),
      id: next_id,
      name: 'line',
      lineCap: 'round',
    })

    vDrawLayer.add(vLastLine)

    destroyed_nodes = []
    undo_log.push({ type: 'vector', id: next_id })
    vShape_index++
    movePathDelay = 0
  } else if (pencilType() === 'pencil 2d') {
    destroyed_nodes = []
    undo_log.push({
      type: '2d',
      prior_data: context.getImageData(0, 0, canvas.width, canvas.height),
    })

    isPaint = true
    lastPointerPosition = stage.getPointerPosition()

    movePathDelay = 0
  } else if (
    pencilType() === 'curve' &&
    globalCompisteOperation() === 'destination-out'
  ) {
    isPaint = true

    let next_id = 'cline_' + cShape_index
    vLastLine = new Konva.Line({
      stroke: vBrushColor,
      strokeWidth: vBrushSizes(),
      globalCompositeOperation: globalCompisteOperation(),
      id: next_id,
      name: 'line',
      lineCap: 'round',
    })

    curveLayer.add(vLastLine)

    destroyed_nodes = []
    undo_log.push({ type: 'curveEraser', id: next_id })
    cShape_index++
    movePathDelay = 0
  }
})

stage.on('mouseleave', function () {
  if (mobileDoubleTouch) {
    mobileDoubleTouch = false
  }

  drawMovePathArray()

  movePathDelay = 0
  isPaint = false
})

stage.on('touchstart', function (e) {
  bufferWidth = 50
  lineBufferWidth = 50
})

stage.on('mouseup touchend', function (e) {
  if (mobileDoubleTouch) {
    mobileDoubleTouch = false
    ignoreNextPoint = true
  } else if (pointDrag === true) {
    pointDrag = false
  } else if (lineHovered && pencilType() === 'curve') {
    hoverLineClick(e)
  } else if (justActiveated && e.type === 'touchend') {
    justActiveated = false
  } else if (
    pencilType() === 'curve' &&
    globalCompisteOperation() !== 'destination-out'
  ) {
    justActiveated = false
    if (ignoreNextPoint === true) {
      ignoreNextPoint = false
    } else {
      createCurvePoint()
    }
  }

  if (pencilType() === 'pencil 2d') {
    let undoLogCount = undo_log.length - 1

    undo_log[undoLogCount] = {
      ...undo_log[undoLogCount],
      current_data: context.getImageData(0, 0, canvas.width, canvas.height),
    }
  }
  drawMovePathArray()

  movePathDelay = 0
  isPaint = false
})

stage.on('mousemove touchmove', function (e) {
  if (mobileDoubleTouch) {
    return
  }

  if (!isPaint) {
    return
  }

  if (isDraggableOn) {
    return
  }

  let drawScale = stage.scaleX()
  let stageX = Math.abs(stage.x())
  let stageY = Math.abs(stage.y())
  let pos = stage.getPointerPosition()

  if (pencilType() === 'pencil 2d') {
    context.globalCompositeOperation = globalCompisteOperation()

    context.beginPath()

    let localPosFrom = {
      x: (lastPointerPosition.x + stageX) / drawScale,
      y: (lastPointerPosition.y + stageY) / drawScale,
    }

    context.moveTo(localPosFrom.x, localPosFrom.y)

    localPos = {
      x: (pos.x + stageX) / drawScale,
      y: (pos.y + stageY) / drawScale,
    }

    lastPointerPosition = pos

    if (movePathDelay < movePathDelayCount) {
      movePathArray[movePathDelay] = {
        fromX: localPosFrom.x,
        fromY: localPosFrom.y,
        toX: localPos.x,
        toY: localPos.y,
      }

      movePathDelay++
    } else {
      if (movePathArray.length > 0) {
        drawMovePathArray()
      }
      draw(localPosFrom.x, localPosFrom.y, localPos.x, localPos.y)
    }
  } else if (
    pencilType() === 'pencil vector' ||
    (pencilType() === 'curve' &&
      globalCompisteOperation() === 'destination-out')
  ) {
    //  ***************** draw vector ****************

    if (movePathDelay < movePathDelayCount) {
      vMovePathArray[movePathDelay] = [
        (pos.x + stageX) / drawScale,
        (pos.y + stageY) / drawScale,
      ]
      movePathDelay++
    } else {
      if (vMovePathArray.length > 0) {
        drawVMovePathArray()
      }
      vDraw([(pos.x + stageX) / drawScale, (pos.y + stageY) / drawScale])
    }
  }
})

function draw(fromX, fromY, toX, toY) {
  context.moveTo(fromX, fromY)
  stage.getPointerPosition()
  context.lineTo(toX, toY)
  context.closePath()
  context.stroke()
  drawLayer.batchDraw()
}

function drawMovePathArray() {
  for (let i = 0; i < movePathArray.length; i++) {
    draw(
      movePathArray[i].fromX,
      movePathArray[i].fromY,
      movePathArray[i].toX,
      movePathArray[i].toY
    )
  }
  movePathArray = []
}

function vDraw(points) {
  var newPoints = vLastLine.points().concat(points)

  vLastLine.points(newPoints)
}

function drawVMovePathArray() {
  for (let i = 0; i < vMovePathArray.length; i++) {
    vDraw(vMovePathArray[i])
  }
  vMovePathArray = []
}

//********************************************
//***           SVG Download               ***
//********************************************

function svgDownload() {
  completeShape()
  download('vectorLayer.svg', getSvgData())
}

function buildSvgDrawArrayFromJson(newPos) {
  let json = JSON.parse(vDrawLayer.toJSON())
  let lines = json['children']
  let line = []
  let vMovePathArrays = []
  let svgAttributes = []
  let strokeWidth = ''
  let stroke = ''
  let globalCompositeOperation = ''

  let saveX = ''
  let q = 0

  for (let i = 0; i < lines.length; i++) {
    line = lines[i]['attrs']['points']
    strokeWidth = lines[i]['attrs'].strokeWidth
    stroke = lines[i]['attrs'].stroke
    globalCompositeOperation = lines[i]['attrs'].globalCompositeOperation

    if (line) {
      vMovePathArrays[i] = []
      q = 0
      for (let j = 0; j < line.length; j++) {
        if (j % 2 === 0) {
          saveX = line[j]
        } else {
          vMovePathArrays[i][q] = [saveX + newPos.x, line[j] + newPos.y]
          q++
        }
      }
    }

    svgAttributes[i] = {
      vLine: line,
      vStrokeWidth: strokeWidth,
      vStroke: stroke,
      vGlobalCompositeOperation: globalCompositeOperation,
    }
  }

  return [vMovePathArrays, svgAttributes]
}

function getSvgData() {
  let json = JSON.parse(vDrawLayer.toJSON())
  let cjson = JSON.parse(curveLayer.toJSON())
  let maskLines = ''
  let maskCount = ''
  let maskTogether = ''
  let pathLines = ''
  let pathLine = ''
  let svgFile = ''

  let lines = json['children']
  let cLines = cjson['children']

  svgFile += `<svg width="${getWidth()}" height="${getHeight()}"`
  svgFile += ` xmlns="http://www.w3.org/2000/svg">`

  // *****  Vector Layer *****

  for (let i = lines.length - 1; i >= 0; i--) {
    pathLine = ''
    j = i - 1 < 0 ? 0 : i - 1

    globalOperation = lines[i]['attrs']['globalCompositeOperation']
    nextGlobalOperation = lines[j]['attrs']['globalCompositeOperation']
    pathLine += convertLineToSvgPath(lines[i]['attrs'])

    if (globalOperation) {
      maskTogether += pathLine
      if (!nextGlobalOperation) {
        maskCount++
        maskLines += `<mask id="veraser${maskCount}"><rect width="100%" height="100%" fill="#fff"></rect>${maskTogether}</mask>`
      }
    } else {
      if (maskCount) {
        pathLines += `<g mask="url(#veraser${maskCount})">`
      }
      pathLines += pathLine
      if (maskCount) {
        pathLines += `</g>`
      }
    }
  }

  svgFile += maskLines
  svgFile += pathLines

  maskLines = ''
  maskTogether = ''
  pathLines = ''
  pathLine = ''
  maskCount = 0

  // ***** curve layer *****

  for (let x = cLines.length - 1; x >= 0; x--) {
    pathLine = ''

    y = x - 1 < 0 ? 0 : x - 1

    className = cLines[x]['className']
    nextGlobalOperation = cLines[y]['attrs']['globalCompositeOperation']
    globalOperation = cLines[x]['attrs']['globalCompositeOperation']
    lineId = cLines[x]['attrs']['lineId']
    linesShape = cLines[x]['attrs']['linesShape']

    if (className === 'Line' && globalOperation === 'destination-out') {
      pathLine += convertLineToSvgPath(cLines[x]['attrs'])

      maskTogether += pathLine
      if (nextGlobalOperation !== 'destination-out') {
        maskCount++
        maskLines += `<mask id="ceraser${maskCount}"><rect width="100%" height="100%" fill="#fff"></rect>${maskTogether}</mask>`
      }
    } else if (className === 'Shape') {
      let myLine = lineId.split('.')[1]

      p1 = bezShapes[linesShape].bezLines[myLine].point1
      p2 = bezShapes[linesShape].bezLines[myLine].point2

      bp1 = {
        x: bezShapes[linesShape].bezPoints[p1].x,
        y: bezShapes[linesShape].bezPoints[p1].y,
      }
      bp2 = {
        x: bezShapes[linesShape].bezPoints[p2].x,
        y: bezShapes[linesShape].bezPoints[p2].y,
      }
      bc1 = bezShapes[linesShape].bezLines[myLine].control1
      bc2 = bezShapes[linesShape].bezLines[myLine].control2

      if (maskCount) {
        pathLines += `<g mask="url(#ceraser${maskCount})">`
      }
      pathLines += `<path fill="none" stroke="red" stroke-width="5" d="m${bp1.x},${bp1.y} C${bc1.x},${bc1.y} ${bc2.x},${bc2.y} ${bp2.x},${bp2.y}"></path>`
      if (maskCount) {
        pathLines += `</g>`
      }
    }
  }

  svgFile += maskLines
  svgFile += pathLines

  svgFile += '</svg>'

  return svgFile
}

function convertLineToSvgPath(attributes) {
  line = attributes['points']
  globalOperation = attributes['globalCompositeOperation']
  stroke = attributes['stroke']
  strokeWidth = attributes['strokeWidth']
  lineCap = attributes['lineCap']
  let pathLine = ''

  if (globalOperation) {
    stroke = '#000'
  }

  if (line) {
    pathLine = `<path stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="${lineCap}" fill-opacity="0" d="`

    for (let y = 0; y < line.length; y++) {
      if (y % 2 === 0) {
        if (y === 0) {
          pathLine += ' M'
        } else {
          pathLine += ' L'
        }
      }
      pathLine += ' ' + line[y]
    }
    pathLine += '" />'
  }

  return pathLine
}

function download(filename, text) {
  var element = document.createElement('a')
  element.setAttribute(
    'href',
    'data:text/plain;charset=utf-8,' + encodeURIComponent(text)
  )
  element.setAttribute('download', filename)

  element.style.display = 'none'
  document.body.appendChild(element)

  element.click()

  document.body.removeChild(element)
}

//********************************************
//***        Support for dragging          ***
//********************************************

let container = stage.container()

container.tabIndex = 1
container.focus()

container.addEventListener('keydown', function (e) {
  let kWidth = document.getElementById('container').clientWidth
  let kHeight = document.getElementById('container').clientHeight

  if (e.keyCode === 17) {
    stage.draggable(true)
    stage.dragBoundFunc(function (pos) {
      updateScrollBars()
      return {
        x: getValidCord(pos.x, getWidth(), kWidth),
        y: getValidCord(pos.y, getHeight(), kHeight),
      }
    })
    //
    isDraggableOn = true
  }
})

container.addEventListener('keyup', function (e) {
  if (e.keyCode === 17) {
    stage.draggable(false)
    isDraggableOn = false
    isPaint = false
  }
})

//*********************************************************
//***                Update Graph Size                  ***
//*********************************************************

function updateGraphSize(newKHeight, newKWidth, newGraphHeight, newGraphWidth) {
  stage.width(newKWidth)
  stage.height(newKHeight)

  // Redraw the Graph at new scale
  graphDimensions = { width: newGraphWidth, height: newGraphHeight }
  graphLayer.destroy()
  drawGraph()
  stage.add(graphLayer)
  graphLayer.moveToBottom()
  if (imagePath) {
    imageLayer.moveToBottom()
  }

  let twidth = getWidth()
  let theight = getHeight()
  widthScale = newKWidth / twidth
  heightScale = newKHeight / theight

  scaleStage()

  // //  Re-render any drawing at new scale
  stage.position({ x: 0, y: 0 })
  let oldSize = { width: canvas.width, height: canvas.height }

  updateScrollBars()

  let drawData = export2dCanvasLayer(
    { width: getWidth(), height: getHeight() },
    oldSize
  )

  canvas.width = getWidth()
  canvas.height = getHeight()

  let newSize = { width: canvas.width, height: canvas.height }

  newPos = calculateAnchorOnResize(
    newSize,
    oldSize,
    document.getElementById('anchorSelect').value
  )

  reDraw2dLayer(drawData, newPos)

  reDrawVectorLayer(newPos, newSize, oldSize)

  reDrawCurveLayer(newPos, newSize, oldSize)

  container.focus()

  undo_log = []
}

function export2dCanvasLayer(newSize, oldSize) {
  let currentAnchor = calculateAnchorCurrentOnResize(
    newSize,
    oldSize,
    document.getElementById('anchorSelect').value
  )

  return context.getImageData(
    currentAnchor.x,
    currentAnchor.y,
    oldSize.width,
    oldSize.height
  )
}

function reDraw2dLayer(drawData, pos) {
  context.putImageData(drawData, pos.x, pos.y)

  context.strokeStyle = brushColor
  context.lineJoin = 'round'
  context.lineWidth = brushSizes()
}

function reDrawVectorLayer(newPos, newSize, oldSize, svgArguments) {
  vectorAdjust = calculateAnchorCurrentOnResize(
    newSize,
    oldSize,
    document.getElementById('anchorSelect').value
  )

  if (!svgArguments) {
    svgArguments = buildSvgDrawArrayFromJson(newPos)
  }

  listOfVectorLines = svgArguments[0]

  vDrawLayer.destroy()
  stage.add(vDrawLayer)

  for (let x = 0; x < listOfVectorLines.length; x++) {
    vMovePathArray = listOfVectorLines[x]

    if (vMovePathArray) {
      let next_id = 'vline_' + x
      vLastLine = new Konva.Line({
        stroke: svgArguments[1][x].vStroke,
        strokeWidth: svgArguments[1][x].vStrokeWidth,
        globalCompositeOperation: svgArguments[1][x].vGlobalCompositeOperation,
        lineCap: 'round',
        id: next_id,
      })
      vDrawLayer.add(vLastLine)

      for (let y = 0; y < vMovePathArray.length; y++) {
        vMovePathArray[y] = [
          vMovePathArray[y][0] - vectorAdjust.x,
          vMovePathArray[y][1] - vectorAdjust.y,
        ]
      }

      drawVMovePathArray()
    }
  }
}

function calculateAnchorOnResize(newSize, oldSize, anchorPos) {
  switch (anchorPos) {
    case 'Top-Left':
      return { x: anchorLeft(newSize, oldSize), y: anchorTop(newSize, oldSize) }
    case 'Top-Right':
      return {
        x: anchorRight(newSize, oldSize),
        y: anchorTop(newSize, oldSize),
      }
    case 'Top-Middle':
      return {
        x: anchorWidthMiddle(newSize, oldSize),
        y: anchorTop(newSize, oldSize),
      }
    case 'Middle-Left':
      return {
        x: anchorLeft(newSize, oldSize),
        y: anchorHeightMiddle(newSize, oldSize),
      }
    case 'Middle-Middle':
      return {
        x: anchorWidthMiddle(newSize, oldSize),
        y: anchorHeightMiddle(newSize, oldSize),
      }
    case 'Middle-Right':
      return {
        x: anchorRight(newSize, oldSize),
        y: anchorHeightMiddle(newSize, oldSize),
      }
    case 'Bottom-Left':
      return {
        x: anchorLeft(newSize, oldSize),
        y: anchorBottom(newSize, oldSize),
      }
    case 'Bottom-Middle':
      return {
        x: anchorWidthMiddle(newSize, oldSize),
        y: anchorBottom(newSize, oldSize),
      }
    case 'Bottom-Right':
      return {
        x: anchorRight(newSize, oldSize),
        y: anchorBottom(newSize, oldSize),
      }

    default:
      return { x: 0, y: 0 }
  }
}

function anchorRight(newSize, oldSize) {
  return newSize.width - oldSize.width < 0 ? 0 : newSize.width - oldSize.width
}

function anchorLeft(newSize, oldSize) {
  return 0
}

function anchorWidthMiddle(newSize, oldSize) {
  return (newSize.width - oldSize.width) / 2 < 0
    ? 0
    : (newSize.width - oldSize.width) / 2
}

function anchorTop(newSize, oldSize) {
  return 0
}

function anchorBottom(newSize, oldSize) {
  return newSize.height - oldSize.height < 0
    ? 0
    : newSize.height - oldSize.height
}

function anchorHeightMiddle(newSize, oldSize) {
  return (newSize.height - oldSize.height) / 2 < 0
    ? 0
    : (newSize.height - oldSize.height) / 2
}

function calculateAnchorCurrentOnResize(newSize, oldSize, anchorPos) {
  switch (anchorPos) {
    case 'Top-Left':
      return { x: anchorLeft(newSize, oldSize), y: anchorTop(newSize, oldSize) }
    case 'Top-Right':
      return {
        x: anchorCurrentRight(newSize, oldSize),
        y: anchorCurrentTop(newSize, oldSize),
      }
    case 'Top-Middle':
      return {
        x: anchorCurrentWidthMiddle(newSize, oldSize),
        y: anchorCurrentTop(newSize, oldSize),
      }
    case 'Middle-Left':
      return {
        x: anchorCurrentLeft(newSize, oldSize),
        y: anchorCurrentHeightMiddle(newSize, oldSize),
      }
    case 'Middle-Middle':
      return {
        x: anchorCurrentWidthMiddle(newSize, oldSize),
        y: anchorCurrentHeightMiddle(newSize, oldSize),
      }
    case 'Middle-Right':
      return {
        x: anchorCurrentRight(newSize, oldSize),
        y: anchorCurrentHeightMiddle(newSize, oldSize),
      }
    case 'Bottom-Left':
      return {
        x: anchorCurrentLeft(newSize, oldSize),
        y: anchorCurrentBottom(newSize, oldSize),
      }
    case 'Bottom-Middle':
      return {
        x: anchorCurrentWidthMiddle(newSize, oldSize),
        y: anchorCurrentBottom(newSize, oldSize),
      }
    case 'Bottom-Right':
      return {
        x: anchorCurrentRight(newSize, oldSize),
        y: anchorCurrentBottom(newSize, oldSize),
      }

    default:
      return { x: 0, y: 0 }
  }
}

function anchorCurrentRight(newSize, oldSize) {
  return oldSize.width - newSize.width < 0 ? 0 : oldSize.width - newSize.width
}

function anchorCurrentLeft(newSize, oldSize) {
  return 0
}

function anchorCurrentWidthMiddle(newSize, oldSize) {
  return oldSize.width - newSize.width < 0
    ? 0
    : (oldSize.width - newSize.width) / 2
}

function anchorCurrentTop(newSize, oldSize) {
  return 0
}

function anchorCurrentBottom(newSize, oldSize) {
  return oldSize.height - newSize.height < 0
    ? 0
    : oldSize.height - newSize.height
}

function anchorCurrentHeightMiddle(newSize, oldSize) {
  return oldSize.height - newSize.height < 0
    ? 0
    : (oldSize.height - newSize.height) / 2
}

//*********************************************************
//***                  Bezier Shapes                    ***
//*********************************************************

function togglePencil() {
  if (
    pencilType() !== 'curve' ||
    globalCompisteOperation() === 'destination-out'
  ) {
    completeShape()
    context.lineWidth = brushSizes()
  }
}

let bezShapeCount = 0
let currentBezShape = 0
let bezPointCount = 0
let currentBezPoint = 0
let priorBezPoint = ''
let bezLineCount = 0
let currentBezLine = 0

let bezShapes = []
let circle = []
let visibleCircle = []
let line = []
let linePoints = []
let lineFromBezPoints = []
let cPoint = []
let cLine = []
let visiblecPoint = []
let pointArray = []

let bezOpen = false
let controlPointClicked = false
let tensionPointClicked = false
let visiblePoints = false
let pointDrag = false
let justActiveated = false

let lineBufferWidth = 15
let bufferWidth = 15
let pointSize = 5

function getHoverLineWidth() {
  return Math.max((lineBufferWidth / stage.scaleY()) * globalHScale, pointSize)
}

function touchPointRadius() {
  return Math.max((bufferWidth / stage.scaleY()) * globalHScale, pointSize)
}

function createCurvePoint() {
  //  bezOpen is true when it should not be when re-doing a closed shape
  //  create
  if (controlPointClicked) {
    controlPointClicked = false
  } else if (tensionPointClicked) {
    tensionPointClicked = false
  } else if (visiblePoints && !bezOpen) {
    completeShape()
  } else if (justActiveated === true) {
    justActiveated = false
  } else if (pencilType() === 'curve') {
    if (!bezOpen) {
      initializeNewShape()
    }

    let pos = stage.getRelativePointerPosition()

    if (bezPointCount > 0) {
      priorBezPoint = getLastBezPoint()
    }

    bezPointCount++
    currentBezPoint = bezPointCount

    bezShapes[currentBezShape].bezPoints[currentBezPoint] = {
      x: pos.x,
      y: pos.y,
      prior: priorBezPoint,
      next: false,
    }

    if (bezPointCount <= 1) {
      drawPoint(currentBezShape, currentBezPoint, pos, true)
    } else {
      bezShapes[currentBezShape].bezPoints[priorBezPoint] = {
        ...bezShapes[currentBezShape].bezPoints[priorBezPoint],
        next: currentBezPoint,
      }

      drawPoint(currentBezShape, currentBezPoint, pos, true)

      bezLineCount++
      currentBezLine = bezLineCount

      bezShapes[currentBezShape].bezLines[currentBezLine] = {
        point1: priorBezPoint,
        point2: currentBezPoint,
        control1From: 'auto',
        control2From: 'auto',
      }

      bezShapes[currentBezShape].bezPoints[priorBezPoint] = {
        ...bezShapes[currentBezShape].bezPoints[priorBezPoint],
        line2: currentBezLine,
      }

      bezShapes[currentBezShape].bezPoints[currentBezPoint] = {
        ...bezShapes[currentBezShape].bezPoints[currentBezPoint],
        line1: currentBezLine,
      }

      let priorPoint = bezShapes[currentBezShape].bezPoints[priorBezPoint]
      let currentPoint = bezShapes[currentBezShape].bezPoints[currentBezPoint]

      let priorPointControl = getControlForPoint(currentBezShape, priorPoint)
      let currentPointControl = getControlForPoint(
        currentBezShape,
        currentPoint
      )

      drawLine(
        currentBezShape + '.' + currentBezLine,
        priorPoint.x,
        priorPoint.y,
        priorPointControl[2],
        priorPointControl[3],
        currentPointControl[0],
        currentPointControl[1],
        currentPoint.x,
        currentPoint.y
      )

      drawTensionPoint(
        priorPointControl[2],
        priorPointControl[3],
        priorPoint.x,
        priorPoint.y,
        currentBezShape + '.' + priorBezPoint + '.' + 2,
        currentBezLine,
        2
      )

      drawTensionPoint(
        currentPointControl[0],
        currentPointControl[1],
        currentPoint.x,
        currentPoint.y,
        currentBezShape + '.' + currentBezPoint + '.' + 1,
        currentBezLine,
        1
      )

      curveLayer.add(line[currentBezShape + '.' + currentBezLine])
      line[currentBezShape + '.' + currentBezLine].moveToTop()
      curveLayer.add(lineFromBezPoints[currentBezShape + '.' + currentBezLine])
      lineFromBezPoints[currentBezShape + '.' + currentBezLine].moveToTop()

      reDrawShape(currentBezShape, true)
    }
  }
}

function initializeNewShape() {
  bezOpen = true
  bezShapeCount++
  currentBezShape = bezShapeCount
  bezPointCount = 0
  currentBezPoint = 0
  bezLineCount = 0
  priorBezPoint = false
  bezShapes[currentBezShape] = {
    bezPoints: [],
    bezLines: [],
  }
  visiblePoints = true
}

function drawPoint(currentBezShape, currentBezPoint, pos, newPoint) {

  let newCircle = currentBezShape + '.' + currentBezPoint

  circle[newCircle] = new Konva.Circle({
    x: pos.x,
    y: pos.y,
    radius: touchPointRadius(),
    bezPoint: currentBezPoint,
    draggable: true,
    stroke: '',
    linesShape: currentBezShape,
  })

  circle[newCircle].dragBoundFunc(function (pos) {
    let posShape = stage.getRelativePointerPosition()
    let currentStageWidth = (stage.width() * stage.scaleX()) / globalWScale
    let currentStageHeight = (stage.width() * stage.scaleX()) / globalHScale

    bezShapes[currentBezShape].bezPoints[currentBezPoint] = {
      ...bezShapes[currentBezShape].bezPoints[currentBezPoint],
      x: Math.min(Math.max(posShape.x, 0), getWidth()),
      y: Math.min(Math.max(posShape.y, 0), getHeight()),
    }

    reDrawShape(currentBezShape, true)

    let thisCircle = currentBezShape + '.' + currentBezPoint

    visibleCircle[thisCircle].setAttr('x', circle[thisCircle].getAttr('x'))
    visibleCircle[thisCircle].setAttr('y', circle[thisCircle].getAttr('y'))

    if (pointDrag !== true) {
      pointDrag = true

      destroyed_nodes = []
      undo_log.push({
        type: 'bezPointDrag',
        data: {
          shape: currentBezShape,
          point: currentBezPoint,
          x: bezShapes[currentBezShape].bezPoints[currentBezPoint].x,
          y: bezShapes[currentBezShape].bezPoints[currentBezPoint].y,
        },
      })
    }

    return {
      x: Math.min(
        Math.max(pos.x, stage.position().x),
        currentStageWidth - Math.abs(stage.position().x)
      ),
      y: Math.min(
        Math.max(pos.y, stage.position().y),
        currentStageHeight - Math.abs(stage.position().y)
      ),
    }
  })

  visibleCircle[newCircle] = new Konva.Circle({
    x: pos.x,
    y: pos.y,
    radius: pointSize,
    stroke: 'black',
    bezPoint: currentBezPoint,
    linesShape: currentBezShape,
  })

  curveLayer.add(visibleCircle[newCircle])
  curveLayer.add(circle[newCircle])
  visibleCircle[newCircle].moveToTop()
  circle[newCircle].moveToTop()

  circle[currentBezShape + '.' + currentBezPoint].on('mouseover', function (e) {
    mouseOverLine(e)
  })

  circle[currentBezShape + '.' + currentBezPoint].on('mouseout', function (e) {
    mouseOffLine(e)
  })

  circle[currentBezShape + '.' + currentBezPoint].on(
    'mouseup touchend',
    function (bezPointData) {
      processMouseUpOnPoint(bezPointData)
    }
  )

  if (newPoint) {
    undo_log.push({
      type: 'bezPoint',
      data: { bezShape: currentBezShape, bezPoint: currentBezPoint },
    })
    destroyed_nodes = []
  }
}

function processMouseUpOnPoint(bezPointData) {
  if (pointDrag === true) {
    pointDrag = false
    controlPointClicked = true
  } else if (!lineHovered) {
    controlPointClicked = true
    let bezPoint = bezPointData.target.attrs.bezPoint
    if (
      !bezShapes[currentBezShape].bezPoints[bezPoint].prior &&
      bezPointCount > 2 &&
      pencilType() === 'curve'
    ) {
      completeTheShape(bezPoint)
    } else if (
      !bezShapes[currentBezShape].bezPoints[bezPoint].next &&
      pencilType() === 'curve'
    ) {
      completeShape()
      controlPointClicked = false
    }
  }
}

function completeTheShape(bezPoint) {
  let priorBezPoint = getLastBezPoint()

  bezShapes[currentBezShape].bezPoints[bezPoint] = {
    ...bezShapes[currentBezShape].bezPoints[bezPoint],
    prior: priorBezPoint,
  }

  bezShapes[currentBezShape].bezPoints[priorBezPoint] = {
    ...bezShapes[currentBezShape].bezPoints[priorBezPoint],
    next: bezPoint,
  }

  bezLineCount++
  currentBezLine = bezLineCount
  bezShapes[currentBezShape].bezLines[currentBezLine] = {
    point1: priorBezPoint,
    point2: bezPoint,
    control1From: 'auto',
    control2From: 'auto',
  }

  drawLine(currentBezShape + '.' + currentBezLine, 0, 0, 0, 0, 0, 0, 0, 0)
  bezShapes[currentBezShape].bezPoints[bezPoint].line1 = currentBezLine
  bezShapes[currentBezShape].bezPoints[priorBezPoint].line2 = currentBezLine

  drawTensionPoint(
    0,
    0,
    0,
    0,
    currentBezShape + '.' + priorBezPoint + '.' + 2,
    currentBezLine,
    2
  )

  drawTensionPoint(
    0,
    0,
    0,
    0,
    currentBezShape + '.' + bezPoint + '.' + 1,
    currentBezLine,
    1
  )

  curveLayer.add(line[currentBezShape + '.' + currentBezLine])
  line[currentBezShape + '.' + currentBezLine].moveToTop()
  curveLayer.add(lineFromBezPoints[currentBezShape + '.' + currentBezLine])
  lineFromBezPoints[currentBezShape + '.' + currentBezLine].moveToTop()

  reDrawShape(currentBezShape, true)
  bezOpen = false

  undo_log.push({
    type: 'bezShape',
    data: { bezShape: currentBezShape },
  })
  destroyed_nodes = []
}

function drawLine(
  lineId,
  x1,
  y1,
  cx1,
  cy1,
  cx2,
  cy2,
  x2,
  y2,
  bezShape,
  bezLine
) {
  if (!bezShape) {
    bezShape = currentBezShape
  }
  if (!bezLine) {
    bezLine = currentBezLine
  }

  line[lineId] = new Konva.Shape({
    stroke: 'red',
    strokeWidth: 4,
    lineId: lineId,
    fill: '',
    //*************************************** */
    globalCompositeOperation: 'source-Over',
    sceneFunc: (ctx, shape) => {
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.bezierCurveTo(cx1, cy1, cx2, cy2, x2, y2)
      ctx.fillStrokeShape(shape)
    },
    linesShape: bezShape,
  })

  linePoints[lineId] = new BezierCurve([
    new Point(x1, y1),
    new Point(cx1, cy1),
    new Point(cx2, cy2),
    new Point(x2, y2),
  ])

  pointArray = []

  for (let x = 0; x < linePoints[lineId].drawingPoints.length; x++) {
    pointArray.push(linePoints[lineId].drawingPoints[x].x)
    pointArray.push(linePoints[lineId].drawingPoints[x].y)
  }

  lineFromBezPoints[lineId] = new Konva.Line({
    points: pointArray,
    stroke: 'white',
    strokeWidth: getHoverLineWidth(),
    lineCap: 'round',
    lineJoin: 'round',
    opacity: 0,
    linesShape: bezShape,
    lineId: lineId,
  })

  lineFromBezPoints[lineId].on('mouseover', function (e) {
    if (
      pencilType() === 'curve' &&
      globalCompisteOperation() !== 'destination-out'
    ) {
      mouseOverLine(e)
      lineHovered = true
    }
  })

  lineFromBezPoints[lineId].on('mouseout', function (e) {
    if (
      pencilType() === 'curve' &&
      globalCompisteOperation() !== 'destination-out'
    ) {
      mouseOffLine(e)
      lineHovered = false
    }
  })

  lineFromBezPoints[lineId].on('touchend', function (e) {
    if (
      currentBezShape === e.target.getAttr('linesShape') ||
      !currentBezShape
    ) {
      hoverLineClick(e)
    }
  })
}

function mouseOverLine(e) {
  linesShape = e.target.getAttr('linesShape')
  if (currentBezShape && currentBezShape !== linesShape) {
    return
  } else {
    for (let x = 1; x < bezShapes[linesShape].bezLines.length; x++) {
      thisLineId = linesShape + '.' + x
      line[thisLineId].setAttr('stroke', 'blue')
    }
  }
}

function mouseOffLine(e) {
  linesShape = e.target.getAttr('linesShape')
  for (let x = 1; x < bezShapes[linesShape].bezLines.length; x++) {
    thisLineId = linesShape + '.' + x
    line[thisLineId].setAttr('stroke', 'red')
  }
}

function drawTensionPoint(cx, cy, px, py, cpid, lineId, lineCpNum) {
  cPoint[cpid] = new Konva.Circle({
    x: cx,
    y: cy,
    radius: touchPointRadius(),
    draggable: 'true',
    lineId: lineId,
    lineCpNum: lineCpNum,
    stroke: '',
    cLineShape: currentBezShape,
  })

  visiblecPoint[cpid] = new Konva.Circle({
    x: cx,
    y: cy,
    radius: pointSize,
    opacity: 0.5,
    stroke: 'green',
    lineId: lineId,
    lineCpNum: lineCpNum,
    cLineShape: currentBezShape,
  })

  cLine[cpid] = new Konva.Line({
    points: [cx, cy, px, py],
    opacity: 0.5,
    stroke: 'green',
    strokeWidth: 1,
    cLineShape: currentBezShape,
  })

  curveLayer.add(visiblecPoint[cpid])
  curveLayer.add(cPoint[cpid])
  curveLayer.add(cLine[cpid])

  let newPoints = []

  cPoint[cpid].dragBoundFunc(function (pos) {
    let posShape = stage.getRelativePointerPosition()

    linePoints = cLine[cpid].getAttr('points')
    if (lineCpNum === 1) {
      newPoints = [posShape.x, posShape.y, linePoints[0], linePoints[1]]
      bezShapes[currentBezShape].bezLines[lineId].control1 = {
        x: Math.min(Math.max(posShape.x, 0), getWidth()),
        y: Math.min(Math.max(posShape.y, 0), getHeight()),
      }
      bezShapes[currentBezShape].bezLines[lineId].control1From = 'user'
    } else {
      newPoints = [posShape.x, posShape.y, linePoints[2], linePoints[3]]
      bezShapes[currentBezShape].bezLines[lineId].control2 = {
        x: Math.min(Math.max(posShape.x, 0), getWidth()),
        y: Math.min(Math.max(posShape.y, 0), getHeight()),
      }
      bezShapes[currentBezShape].bezLines[lineId].control2From = 'user'
    }
    cLine[cpid].setAttr('points', newPoints)

    reDrawShape(currentBezShape, true)

    return {}
  })

  cPoint[cpid].on('mousedown touchstart', function () {
    if (!lineHovered) {
      tensionPointClicked = true

      let bezLine = cPoint[cpid].getAttr('lineId')
      let bezShape = cPoint[cpid].getAttr('cLineShape')

      destroyed_nodes = []
      undo_log.push({
        type: 'bez_cPointDrag',
        shape: bezShape,
        line: bezLine,
        data: JSON.parse(JSON.stringify(bezShapes[bezShape].bezLines[bezLine])),
      })
    }
  })
}

function updateTouchPoints() {
  let myPoint = ''
  let myLine = ''
  for (let y = 1; y < bezShapes.length; y++) {
    for (let x = 1; x < bezShapes[y].bezPoints.length; x++) {
      myPoint = y + '.' + x

      circle[myPoint].setAttr('radius', touchPointRadius())

      thisId1 = y + '.' + x + '.' + 1
      thisId2 = y + '.' + x + '.' + 2

      if (cPoint[thisId1]) {
        cPoint[thisId1].setAttr('radius', touchPointRadius())
      }

      if (cPoint[thisId2]) {
        cPoint[thisId2].setAttr('radius', touchPointRadius())
      }
    }

    for (let z = 1; z < bezShapes[y].bezLines.length; z++) {
      myLine = y + '.' + z
      lineFromBezPoints[myLine].setAttr('strokeWidth', getHoverLineWidth())
    }
  }
}

function convertCircleArray() {
  let myPoint = ''
  let circleArray = []
  for (let y = 1; y < bezShapes.length; y++) {
    for (let x = 1; x < bezShapes[y].bezPoints.length; x++) {
      myPoint = y + '.' + x
      circle[myPoint] = { ...circle[myPoint], circleId: myPoint }
      circleArray.push(circle[myPoint])
    }
  }

  return circleArray
}

function restoreCircleArray(circleArray) {
  for (let x = 0; x < circleArray.length; x++) {
    myPoint = circleArray[x].circleId
    circle[myPoint] = circleArray[x]
  }
}

function completeShape() {
  if (currentBezShape) {
    removeShapeVisiblePoints(currentBezShape)
    removeShapeTensionPoints(currentBezShape)
  }

  visiblePoints = false
  bezOpen = false
  currentBezShape = ''
}

function removeShapeVisiblePoints(bezShape) {
  let thisPoint = ''
  for (let x = 1; x < bezShapes[bezShape].bezPoints.length; x++) {
    thisPoint = bezShape + '.' + x
    circle[thisPoint].remove()
    visibleCircle[thisPoint].remove()
  }
}

function removeShapeTensionPoints(bezShape) {
  for (let x = 1; x < bezShapes[bezShape].bezPoints.length; x++) {
    thisId1 = bezShape + '.' + x + '.' + 1
    thisId2 = bezShape + '.' + x + '.' + 2

    if (cPoint[thisId1]) {
      cPoint[thisId1].remove()
      visiblecPoint[thisId1].remove()
    }
    if (cLine[thisId1]) {
      cLine[thisId1].remove()
    }
    if (cPoint[thisId2]) {
      cPoint[thisId2].remove()
      visiblecPoint[thisId2].remove()
    }
    if (cLine[thisId2]) {
      cLine[thisId2].remove()
    }
  }
}

function reDrawShape(bezShape, moveToTop) {
  for (let x = 1; x < bezShapes[bezShape].bezLines.length; x++) {
    let redrawParams = getReadrawParameters(bezShape, x)

    let curveFunction = (context, shape) => {
      context.beginPath()
      context.moveTo(redrawParams[0], redrawParams[1])
      context.bezierCurveTo(
        redrawParams[2],
        redrawParams[3],
        redrawParams[4],
        redrawParams[5],
        redrawParams[6],
        redrawParams[7]
      )
      context.fillStrokeShape(shape)
    }

    let lineId = currentBezShape + '.' + x

    line[lineId].attrs.sceneFunc = curveFunction

    linePoints[lineId] = new BezierCurve([
      new Point(redrawParams[0], redrawParams[1]),
      new Point(redrawParams[2], redrawParams[3]),
      new Point(redrawParams[4], redrawParams[5]),
      new Point(redrawParams[6], redrawParams[7]),
    ])

    pointArray = []

    for (let bps = 0; bps < linePoints[lineId].drawingPoints.length; bps++) {
      pointArray.push(linePoints[lineId].drawingPoints[bps].x)
      pointArray.push(linePoints[lineId].drawingPoints[bps].y)
    }

    lineFromBezPoints[lineId].setAttr('points', pointArray)

    if (moveToTop) {
       line[lineId].moveToTop()
       lineFromBezPoints[lineId].moveToTop()
    }

    let p1 = bezShapes[bezShape].bezLines[x].point1
    let p2 = bezShapes[bezShape].bezLines[x].point2
    let cp2id = currentBezShape + '.' + p1 + '.' + 2
    let cp1id = currentBezShape + '.' + p2 + '.' + 1

    updateControlPoint(
      redrawParams[2],
      redrawParams[3],
      redrawParams[0],
      redrawParams[1],
      cp1id
    )

    updateControlPoint(
      redrawParams[4],
      redrawParams[5],
      redrawParams[6],
      redrawParams[7],
      cp2id
    )
  }

  for (let y = 1; y < bezShapes[bezShape].bezPoints.length; y++) {
    circle[bezShape + '.' + y].moveToTop()
  }
}

function updateControlPoint(cx, cy, px, py, cpid) {
  if (!cPoint[cpid]) {
    return
  }

  cPoint[cpid].setAttr('x', cx)
  visiblecPoint[cpid].setAttr('x', cx)
  cPoint[cpid].setAttr('y', cy)
  visiblecPoint[cpid].setAttr('y', cy)
  cLine[cpid].setAttr('points', [cx, cy, px, py])
}

function getReadrawParameters(bezShape, bezLine) {
  let p1 = bezShapes[bezShape].bezLines[bezLine].point1
  let p2 = bezShapes[bezShape].bezLines[bezLine].point2

  let lc1 = bezShapes[bezShape].bezLines[bezLine].control1
  let lc2 = bezShapes[bezShape].bezLines[bezLine].control2

  if (bezLine === 1) {
    let x1 = bezShapes[bezShape].bezPoints[p1].x
    let y1 = bezShapes[bezShape].bezPoints[p1].y
    let x2 = bezShapes[bezShape].bezPoints[p2].x
    let y2 = bezShapes[bezShape].bezPoints[p2].y
  }

  if (bezShapes[bezShape].bezLines[bezLine].control1From === 'user') {
    c1x = lc1.x
    c1y = lc1.y
  } else {
    let c1 = getControlForPoint(bezShape, bezShapes[bezShape].bezPoints[p1])
    c1x = c1[2]
    c1y = c1[3]

    bezShapes[bezShape].bezLines[bezLine].control1 = { x: c1x, y: c1y }
  }

  if (bezShapes[bezShape].bezLines[bezLine].control2From === 'user') {
    c2x = lc2.x
    c2y = lc2.y
  } else {
    let c2 = getControlForPoint(bezShape, bezShapes[bezShape].bezPoints[p2])
    c2x = c2[0]
    c2y = c2[1]

    bezShapes[bezShape].bezLines[bezLine].control2 = { x: c2x, y: c2y }
  }

  let x1 = circle[bezShape + '.' + p1].attrs.x
  let y1 = circle[bezShape + '.' + p1].attrs.y
  let x2 = circle[bezShape + '.' + p2].attrs.x
  let y2 = circle[bezShape + '.' + p2].attrs.y

  return [x1, y1, c1x, c1y, c2x, c2y, x2, y2]
}

function getControlForPoint(shapeId, pointId) {
  if (pointId.prior) {
    priorPoint = bezShapes[shapeId].bezPoints[pointId.prior]
  } else {
    priorPoint = pointId
  }

  if (pointId.next) {
    nextPoint = bezShapes[shapeId].bezPoints[pointId.next]
  } else {
    nextPoint = pointId
  }

  return getControlPoints(
    priorPoint.x,
    priorPoint.y,
    pointId.x,
    pointId.y,
    nextPoint.x,
    nextPoint.y,
    defaultTension
  )
}

// http://scaledinnovation.com/analytics/splines/aboutSplines.html
function getControlPoints(x0, y0, x1, y1, x2, y2, t) {
  var d01 = Math.sqrt(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2))
  var d12 = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
  var fa = (t * d01) / (d01 + d12) // scaling factor for triangle Ta
  var fb = (t * d12) / (d01 + d12) // ditto for Tb, simplifies to fb=t-fa
  var p1x = x1 - fa * (x2 - x0) // x2-x0 is the width of triangle T
  var p1y = y1 - fa * (y2 - y0) // y2-y0 is the height of T
  var p2x = x1 + fb * (x2 - x0)
  var p2y = y1 + fb * (y2 - y0)
  return [p1x, p1y, p2x, p2y]
}

//  ******************************************************************************

//  When entire layer is re-drawn on change of stage size

function reDrawCurveLayer(newPos, newSize, oldSize) {
  let curveLayerObjects = JSON.parse(curveLayer.toJSON())
  let currentShape = ''
  let drawEraserAfter = []

  for (let object = 0; object < curveLayerObjects.children.length; object++) {
    newObject = curveLayerObjects.children[object]
    if (newObject.className === 'Shape') {
      currentShape = newObject.attrs['lineId'].split('.')[0]
    } else if (
      newObject.className === 'Line' &&
      newObject.attrs['globalCompositeOperation'] === 'destination-out'
    ) {
      node = stage.findOne('#' + newObject.attrs['id'])

      drawEraserAfter.push({
        shape: currentShape,
        eraserId: newObject.attrs['id'],
        node: node,
      })
    }
  }

  curveLayer.destroy()
  stage.add(curveLayer)

  vectorAdjust = calculateAnchorCurrentOnResize(
    newSize,
    oldSize,
    document.getElementById('anchorSelect').value
  )

  newPos.x = newPos.x - vectorAdjust.x
  newPos.y = newPos.y - vectorAdjust.y

  for (let bezShape = 1; bezShape < bezShapes.length; bezShape++) {
    for (
      let pointId = 1;
      pointId < bezShapes[bezShape].bezPoints.length;
      pointId++
    ) {
      bezShapes[bezShape].bezPoints[pointId].x =
        bezShapes[bezShape].bezPoints[pointId].x + newPos.x
      bezShapes[bezShape].bezPoints[pointId].y =
        bezShapes[bezShape].bezPoints[pointId].y + newPos.y

      circle[bezShape + '.' + pointId].attrs.x =
        circle[bezShape + '.' + pointId].attrs.x + newPos.x
      circle[bezShape + '.' + pointId].attrs.y =
        circle[bezShape + '.' + pointId].attrs.y + newPos.y
    }

    for (let x = 1; x < bezShapes[bezShape].bezLines.length; x++) {
      if (bezShapes[bezShape].bezLines[x].control1From === 'user') {
        bezShapes[bezShape].bezLines[x].control1 = {
          x: bezShapes[bezShape].bezLines[x].control1.x + newPos.x,
          y: bezShapes[bezShape].bezLines[x].control1.y + newPos.y,
        }
      }
      if (bezShapes[bezShape].bezLines[x].control2From === 'user') {
        bezShapes[bezShape].bezLines[x].control2 = {
          x: bezShapes[bezShape].bezLines[x].control2.x + newPos.x,
          y: bezShapes[bezShape].bezLines[x].control2.y + newPos.y,
        }
      }

      let redrawParams = getReadrawParameters(bezShape, x)

      drawLine(
        bezShape + '.' + x,
        redrawParams[0],
        redrawParams[1],
        redrawParams[2],
        redrawParams[3],
        redrawParams[4],
        redrawParams[5],
        redrawParams[6],
        redrawParams[7],
        bezShape,
        x
      )

      curveLayer.add(line[bezShape + '.' + x])
      line[bezShape + '.' + x].moveToTop()
      curveLayer.add(lineFromBezPoints[bezShape + '.' + x])
      lineFromBezPoints[bezShape + '.' + x].moveToTop()
    }

    for (let y = 0; y < drawEraserAfter.length; y++) {
      if (Number(drawEraserAfter[y].shape) === bezShape) {
        var redoLine = new Konva.Line({
          stroke: drawEraserAfter[y].node['attrs']['stroke'],
          strokeWidth: drawEraserAfter[y].node['attrs']['strokeWidth'],
          globalCompositeOperation:
            drawEraserAfter[y].node['attrs']['globalCompositeOperation'],
          opacity: drawEraserAfter[y].node['attrs']['opacity'],
          id: drawEraserAfter[y].node['attrs']['id'],
          name: 'line',
        })
        let points = drawEraserAfter[y].node['attrs'].points.slice()
        let adjustedPoints = []

        for (q = 0; q < points.length; q++) {
          if (q % 2 === 0) {
            adjustedPoints.push(points[q] + newPos.y)
          } else {
            adjustedPoints.push(points[q] + newPos.x)
          }
        }

        redoLine.points(adjustedPoints)
        curveLayer.add(redoLine)
      }
    }
  }
}

//  ******************************************************************************

function hoverLineClick(e) {
  if (currentBezShape && e.target.getAttr('linesShape') !== currentBezShape) {
    return
  } else if (visiblePoints) {
    insertControlPoint(e)
  } else {
    activateShape(e)
    justActiveated = true
  }
}

function removeControlPoint(shape, point) {
  if (bezShapes[shape].bezPoints.length === 2) {
    undoShape(shape)
  } else {
    let prior = bezShapes[shape].bezPoints[point].prior
    let next = bezShapes[shape].bezPoints[point].next
    let line1 = bezShapes[shape].bezPoints[point].line1
    let line2 = bezShapes[shape].bezPoints[point].line2

    bezShapes[shape].bezPoints[prior] = {
      ...bezShapes[shape].bezPoints[prior],
      next: next,
    }

    if (line2) {
      bezShapes[shape].bezPoints[prior] = {
        ...bezShapes[shape].bezPoints[prior],
        line2: line2,
      }
    }

    if (next) {
      bezShapes[shape].bezPoints[next] = {
        ...bezShapes[shape].bezPoints[next],
        prior: prior,
      }

      bezShapes[shape].bezLines[line1] = {
        ...bezShapes[shape].bezLines[line1],
        point1: prior,
        point2: next,
      }
    }

    bezShapes[shape].bezLines.pop()
    bezShapes[shape].bezPoints.pop()

    let layerSize = { wdith: kWidth, height: kHeight }
    reDrawCurveLayer({ x: 0, y: 0 }, layerSize, layerSize)
    if (activateShapeOnUndoRedo()) {
      activateShape('', shape)
    }
  }
}

function undoShape(shape) {
  bezShapes.pop()

  bezOpen = false
  bezShapeCount--
  currentBezShape = bezShapeCount
  bezPointCount = 0
  currentBezPoint = 0
  bezLineCount = 0
  priorBezPoint = false
  visiblePoints = false

  let layerSize = { wdith: kWidth, height: kHeight }
  reDrawCurveLayer({ x: 0, y: 0 }, layerSize, layerSize)
}

function removeCompleteShape(shape) {
  let lastLine = bezShapes[shape].bezLines.length - 1

  point1 = bezShapes[shape].bezLines[lastLine].point1
  point2 = bezShapes[shape].bezLines[lastLine].point2
  bezShapes[shape].bezPoints[point1].next = false
  bezShapes[shape].bezPoints[point2].prior = false
  bezShapes[shape].bezLines.pop()

  let layerSize = { wdith: kWidth, height: kHeight }
  reDrawCurveLayer({ x: 0, y: 0 }, layerSize, layerSize)
  activateShape('', shape)
}

function insertControlPoint(e) {
  let pos = stage.getRelativePointerPosition()
  let clickedShape = e.target.getAttr('linesShape')
  let clickedLineId = e.target.getAttr('lineId')
  let clickedLine = clickedLineId.substr(clickedLineId.indexOf('.') + 1)
  let linePoint1 = bezShapes[clickedShape].bezLines[clickedLine].point1
  let linePoint2 = bezShapes[clickedShape].bezLines[clickedLine].point2

  lineHovered = false

  for (
    let pointCount = 1;
    pointCount < bezShapes[clickedShape].bezPoints.length;
    pointCount++
  ) {
    if (
      bezShapes[clickedShape].bezPoints[pointCount].x === pos.x &&
      bezShapes[clickedShape].bezPoints[pointCount].y === pos.y
    ) {
      return
    }
  }

  //  add the new point
  priorBezPoint = linePoint1
  nextBezPoint = linePoint2

  bezPointCount++
  currentBezPoint = bezPointCount

  bezShapes[clickedShape].bezPoints[currentBezPoint] = {
    x: pos.x,
    y: pos.y,
    prior: priorBezPoint,
    next: nextBezPoint,
  }

  drawPoint(clickedShape, currentBezPoint, pos)

  bezLineCount++
  newLine = bezLineCount

  bezShapes[clickedShape].bezLines[newLine] = {
    point1: currentBezPoint,
    point2: nextBezPoint,
    control1From: 'auto',
    control2From: bezShapes[clickedShape].bezLines[clickedLine].control2From,
    control2: bezShapes[clickedShape].bezLines[clickedLine].control2,
  }

  bezShapes[clickedShape].bezLines[clickedLine] = {
    ...bezShapes[clickedShape].bezLines[clickedLine],
    point2: currentBezPoint,
    control2From: 'auto',
  }

  bezShapes[clickedShape].bezPoints[priorBezPoint] = {
    ...bezShapes[clickedShape].bezPoints[priorBezPoint],
    next: currentBezPoint,
  }

  bezShapes[clickedShape].bezPoints[nextBezPoint] = {
    ...bezShapes[clickedShape].bezPoints[nextBezPoint],
    prior: currentBezPoint,
    line1: newLine,
  }

  bezShapes[clickedShape].bezPoints[currentBezPoint] = {
    ...bezShapes[clickedShape].bezPoints[currentBezPoint],
    line1: bezShapes[clickedShape].bezPoints[priorBezPoint].line2,
    line2: newLine,
  }

  drawLine(clickedShape + '.' + newLine, 0, 0, 0, 0, 0, 0, 0, 0)
  curveLayer.add(line[clickedShape + '.' + newLine])
  line[clickedShape + '.' + newLine].moveToTop()
  curveLayer.add(lineFromBezPoints[clickedShape + '.' + newLine])
  lineFromBezPoints[clickedShape + '.' + newLine].moveToTop()

  drawTensionPoint(
    0,
    0,
    0,
    0,
    clickedShape + '.' + currentBezPoint + '.' + 1,
    clickedLine,
    1
  )

  drawTensionPoint(
    0,
    0,
    0,
    0,
    clickedShape + '.' + currentBezPoint + '.' + 2,
    newLine,
    2
  )

  let layerSize = { wdith: kWidth, height: kHeight }
  reDrawCurveLayer({ x: 0, y: 0 }, layerSize, layerSize)
  activateShape(e)

  undo_log.push({
    type: 'bezPoint',
    data: { bezShape: clickedShape, bezPoint: currentBezPoint },
  })
  destroyed_nodes = []
}

function activateShape(e, clickedShape) {
  if (!clickedShape) {
    clickedShape = e.target.getAttr('linesShape')
  }

  currentBezShape = clickedShape
  visiblePoints = true
  bezLineCount = Math.max(bezShapes[currentBezShape].bezLines.length - 1, 0)
  bezPointCount = Math.max(bezShapes[currentBezShape].bezPoints.length - 1, 0)

  for (let x = 1; x < bezShapes[currentBezShape].bezPoints.length; x++) {
    drawPoint(currentBezShape, x, {
      x: bezShapes[currentBezShape].bezPoints[x].x,
      y: bezShapes[currentBezShape].bezPoints[x].y,
    })
  }

  for (let y = 1; y < bezShapes[currentBezShape].bezLines.length; y++) {
    c1 = bezShapes[currentBezShape].bezLines[y].control1
    p1 = bezShapes[currentBezShape].bezLines[y].point1
    p1Pos = {
      x: bezShapes[currentBezShape].bezPoints[p1].x,
      y: bezShapes[currentBezShape].bezPoints[p1].y,
    }
    cpid1 = currentBezShape + '.' + p1 + '.' + 2
    drawTensionPoint(c1.x, c1.y, p1Pos.x, p1Pos.y, cpid1, y, 2)

    c2 = bezShapes[currentBezShape].bezLines[y].control2
    p2 = bezShapes[currentBezShape].bezLines[y].point2
    p2Pos = {
      x: bezShapes[currentBezShape].bezPoints[p2].x,
      y: bezShapes[currentBezShape].bezPoints[p2].y,
    }
    cpid2 = currentBezShape + '.' + p2 + '.' + 1
    drawTensionPoint(c2.x, c2.y, p2Pos.x, p2Pos.y, cpid2, y, 1)
  }

  reDrawShape(currentBezShape)

  if (!bezShapes[currentBezShape].bezPoints[1].prior) {
    bezOpen = true
  }
}

function getLastBezPoint() {
  let point = 1
  while (bezShapes[currentBezShape].bezPoints[point].next) {
    point = bezShapes[currentBezShape].bezPoints[point].next
  }
  return point
}

//  Point and BezierCurve classes and related functions modified from https://github.com/nashvail/BezierCurveGenerator/blob/master/main.js
class Point {
  constructor(x = 0, y = 0) {
    this.x = x

    this.y = y
  }

  x() {
    return this.x
  }

  y() {
    return this.y
  }
}

class BezierCurve {
  constructor(points) {
    if (points instanceof Point) {
      this.points = []
      for (let i = 0; i < arguments.length; i++) {
        if (arguments[i] instanceof Point) {
          this.points.push(arguments[i])
        }
      }
    } else if (typeof points === 'object') {
      this.points = points
    } else {
      this.points = []
    }

    // Drawing points are the number of points that render the curve,
    // the more the number of drawing points, smoother the curve.
    this.numDrawingPoints = 100
    this.drawingPoints = []

    this.calculateDrawingPoints()
  }

  calculateDrawingPoints() {
    let interval = 1 / this.numDrawingPoints
    let t = interval

    this.drawingPoints.push(this.calculateNewPoint(0))

    for (let i = 0; i < this.numDrawingPoints; i++) {
      this.drawingPoints.push(this.calculateNewPoint(t))
      t += interval
    }
  }

  calculateNewPoint(t) {
    // Coordinates calculated using the general formula are relative to
    // origin at bottom left.
    let x = 0
    let y = 0
    let n = this.points.length - 1
    for (let i = 0; i <= n; i++) {
      let bin = C(n, i) * Math.pow(1 - t, n - i) * Math.pow(t, i)
      x += bin * this.points[i].x
      y += bin * this.points[i].y
    }

    return new Point(x, y)
  }
}

function C(n, k) {
  if (typeof n !== 'number' || typeof k !== 'number') {
    return false
  }
  var coeff = 1
  for (var x = n - k + 1; x <= n; x++) coeff *= x
  for (x = 1; x <= k; x++) coeff /= x
  return coeff
}

//*********************************************************
//***                   Undo / Redo                     ***
//*********************************************************

function activateShapeOnUndoRedo() {
  return (
    globalCompisteOperation() !== 'destination-out' && pencilType() === 'curve'
  )
}

function undo_drawing() {
  if (undo_log.length > 0) {
    let logEntry = undo_log.pop()

    if (logEntry.type === 'vector') {
      undoVectorLine(logEntry)
    } else if (logEntry.type === 'curveEraser') {
      undoCurveErase(logEntry)
    } else if (logEntry.type === '2d') {
      undo2dLayer(logEntry)
    } else if (logEntry.type === 'bezPoint') {
      undoBezPoint(logEntry)
    } else if (logEntry.type === 'bezShape') {
      undoCompleteShape(logEntry)
    } else if (logEntry.type === 'bezPointDrag') {
      undoBezPointDrag(logEntry)
    } else if (logEntry.type === 'bez_cPointDrag') {
      undoBezControlPointDrag(logEntry)
    }
  }
}

function undoVectorLine(logEntry) {
  let id_node = logEntry.id
  let node = stage.findOne('#' + id_node)
  if (node != null) {
    destroyed_nodes.push({ type: 'vector', data: node }) //deep copy
    node.destroy()
    vDrawLayer.batchDraw()
  }
}

function undoCurveErase(logEntry) {
  let id_node = logEntry.id
  let node = stage.findOne('#' + id_node)
  if (node != null) {
    destroyed_nodes.push({ type: 'curveEraser', data: node }) //deep copy
    node.destroy()
    curveLayer.batchDraw()
  }
}

function undo2dLayer(logEntry) {
  reDrawVectorLayer(
    { x: 0, y: 0 },
    { width: canvas.width, height: canvas.height },
    { width: canvas.width, height: canvas.height }
  )
  destroyed_nodes.push({
    type: '2d',
    prior_data: logEntry.prior_data,
    current_data: logEntry.current_data,
  })
  reDraw2dLayer(logEntry.prior_data, { x: 0, y: 0 })
}

function undoBezPoint(logEntry) {
  destroyed_nodes.push({
    type: 'bezPoint',
    data: JSON.parse(JSON.stringify(bezShapes[logEntry.data.bezShape])),
    bezShape: logEntry.data.bezShape,
    bezPoint: logEntry.data.bezPoint,
  })

  removeControlPoint(logEntry.data.bezShape, logEntry.data.bezPoint)
}

function undoCompleteShape(logEntry) {
  destroyed_nodes.push({
    type: 'bezShape',
    data: JSON.parse(JSON.stringify(bezShapes[logEntry.data.bezShape])),
    bezShape: logEntry.data.bezShape,
  })

  removeCompleteShape(logEntry.data.bezShape)
}

function undoBezPointDrag(logEntry) {
  destroyed_nodes.push({
    type: 'bezPointDrag',
    data: {
      shape: logEntry.data.shape,
      point: logEntry.data.point,
      x: bezShapes[logEntry.data.shape].bezPoints[logEntry.data.point].x,
      y: bezShapes[logEntry.data.shape].bezPoints[logEntry.data.point].y,
    },
  })

  bezShapes[logEntry.data.shape].bezPoints[logEntry.data.point] = {
    ...bezShapes[logEntry.data.shape].bezPoints[logEntry.data.point],
    x: logEntry.data.x,
    y: logEntry.data.y,
  }

  let layerSize = { wdith: kWidth, height: kHeight }
  reDrawCurveLayer({ x: 0, y: 0 }, layerSize, layerSize)
  if (activateShapeOnUndoRedo()) {
    activateShape('', logEntry.data.shape)
  }
}

function undoBezControlPointDrag(logEntry) {
  destroyed_nodes.push({
    type: 'bez_cPointDrag',
    shape: logEntry.shape,
    line: logEntry.line,
    data: JSON.parse(
      JSON.stringify(bezShapes[logEntry.shape].bezLines[logEntry.line])
    ),
  })

  bezShapes[logEntry.shape].bezLines[logEntry.line] = logEntry.data

  let layerSize = { wdith: kWidth, height: kHeight }
  reDrawCurveLayer({ x: 0, y: 0 }, layerSize, layerSize)
  if (activateShapeOnUndoRedo()) {
    activateShape('', logEntry.shape)
  }
}

function redo_drawing() {
  if (destroyed_nodes.length > 0) {
    var destroyedEntry = destroyed_nodes.pop()

    if (destroyedEntry.type === 'vector') {
      redoVectorLine(destroyedEntry)
    } else if (destroyedEntry.type === 'curveEraser') {
      redoCurveErase(destroyedEntry)
    } else if (destroyedEntry.type == '2d') {
      redo2dLayer(destroyedEntry)
    } else if (destroyedEntry.type === 'bezPoint') {
      redoBezPoint(destroyedEntry)
    } else if (destroyedEntry.type === 'bezShape') {
      redoCompleteShape(destroyedEntry)
    } else if (destroyedEntry.type === 'bezPointDrag') {
      redoBezPointDrag(destroyedEntry)
    } else if (destroyedEntry.type === 'bez_cPointDrag') {
      redoBezControlPointDrag(destroyedEntry)
    }
  }
}

function redoVectorLine(destroyedEntry) {
  var redo_node = destroyedEntry.data
  var redoLine = new Konva.Line({
    stroke: redo_node.getAttr('stroke'),
    strokeWidth: redo_node.getAttr('strokeWidth'),
    globalCompositeOperation: redo_node.getAttr('globalCompositeOperation'),
    opacity: redo_node.getAttr('opacity'),
    id: redo_node.getAttr('id'),
    name: 'line',
  })
  var points = redo_node.points().slice()
  redoLine.points(points)
  vDrawLayer.add(redoLine)
  undo_log.push({ type: 'vector', id: redoLine.getAttr('id') })
  vDrawLayer.batchDraw()
}

function redoCurveErase(destroyedEntry) {
  var redo_node = destroyedEntry.data
  var redoLine = new Konva.Line({
    stroke: redo_node.getAttr('stroke'),
    strokeWidth: redo_node.getAttr('strokeWidth'),
    globalCompositeOperation: redo_node.getAttr('globalCompositeOperation'),
    opacity: redo_node.getAttr('opacity'),
    id: redo_node.getAttr('id'),
    name: 'line',
  })
  var points = redo_node.points().slice()
  redoLine.points(points)
  curveLayer.add(redoLine)
  undo_log.push({ type: 'curveEraser', id: redoLine.getAttr('id') })
  curveLayer.batchDraw()
}

function redo2dLayer(destroyedEntry, testvar) {
  reDrawVectorLayer(
    { x: 0, y: 0 },
    { width: canvas.width, height: canvas.height },
    { width: canvas.width, height: canvas.height }
  )
  undo_log.push({
    type: '2d',
    prior_data: destroyedEntry.prior_data,
    current_data: destroyedEntry.current_data,
  })
  reDraw2dLayer(destroyedEntry.current_data, { x: 0, y: 0 })
  // vDrawLayer.batchDraw()
}

function redoBezPoint(destroyedEntry) {
  undo_log.push({
    type: 'bezPoint',
    data: {
      bezShape: destroyedEntry.bezShape,
      bezPoint: destroyedEntry.bezPoint,
    },
  })
  bezShapes[destroyedEntry.bezShape] = destroyedEntry.data

  bezLineCount--

  bezShapeCount = bezShapes.length - 1

  let layerSize = { wdith: kWidth, height: kHeight }
  reDrawCurveLayer({ x: 0, y: 0 }, layerSize, layerSize)
  if (activateShapeOnUndoRedo()) {
    activateShape('', destroyedEntry.bezShape)
  }
}

function redoCompleteShape(destroyedEntry) {
  bezOpen = false

  undo_log.push({
    type: 'bezShape',
    data: { bezShape: destroyedEntry.bezShape },
  })

  bezShapes[destroyedEntry.bezShape] = destroyedEntry.data

  let layerSize = { wdith: kWidth, height: kHeight }
  reDrawCurveLayer({ x: 0, y: 0 }, layerSize, layerSize)
  if (activateShapeOnUndoRedo()) {
    activateShape('', destroyedEntry.bezShape)
  }
}

function redoBezPointDrag(destroyedEntry) {
  undo_log.push({
    type: 'bezPointDrag',
    data: {
      shape: destroyedEntry.data.shape,
      point: destroyedEntry.data.point,
      x: bezShapes[destroyedEntry.data.shape].bezPoints[
        destroyedEntry.data.point
      ].x,
      y: bezShapes[destroyedEntry.data.shape].bezPoints[
        destroyedEntry.data.point
      ].y,
    },
  })

  bezShapes[destroyedEntry.data.shape].bezPoints[destroyedEntry.data.point] = {
    ...bezShapes[destroyedEntry.data.shape].bezPoints[
      destroyedEntry.data.point
    ],
    x: destroyedEntry.data.x,
    y: destroyedEntry.data.y,
  }

  let layerSize = { wdith: kWidth, height: kHeight }
  reDrawCurveLayer({ x: 0, y: 0 }, layerSize, layerSize)
  if (activateShapeOnUndoRedo()) {
    activateShape('', destroyedEntry.data.shape)
  }
}

function redoBezControlPointDrag(destroyedEntry) {
  undo_log.push({
    type: 'bez_cPointDrag',
    shape: destroyedEntry.shape,
    line: destroyedEntry.line,
    data: JSON.parse(
      JSON.stringify(
        bezShapes[destroyedEntry.shape].bezLines[destroyedEntry.line]
      )
    ),
  })

  bezShapes[destroyedEntry.shape].bezLines[destroyedEntry.line] =
    destroyedEntry.data

  let layerSize = { wdith: kWidth, height: kHeight }
  reDrawCurveLayer({ x: 0, y: 0 }, layerSize, layerSize)
  if (activateShapeOnUndoRedo()) {
    activateShape('', destroyedEntry.shape)
  }
}

//*********************************************************
//***                   Save / Load                     ***
//*********************************************************

function saveStage() {
  let jsonStage = {
    stageData: {
      width: getWidth(),
      height: getHeight(),
      graphVisible: graphVisible,
    },
    stage2dLayer: Array.from(
      context.getImageData(0, 0, canvas.width, canvas.height).data
    ),
    stageVectorLayer: buildSvgDrawArrayFromJson({ x: 0, y: 0 }),
    stageCurveLayer: [bezShapes, convertCircleArray()],
  }

  return [jsonStage, imageLayer.toDataURL()]
}

function loadStage(jsonStage, backgroundImage) {
  newStage()

  if (backgroundImage) {
    displayImage(backgroundImage)
  }
  if (jsonStage) {
    stageSize = {
      width: jsonStage.stageData.width,
      height: jsonStage.stageData.height,
    }

    imageLayer.destroy()
    stage.add(imageLayer)

    updateSize(stageSize.height, stageSize.width)

    document.getElementById('userWidth').value = stageSize.width
    document.getElementById('userWidth').readOnly = false
    document.getElementById('userHeight').value = stageSize.height
    document.getElementById('userHeight').readOnly = false

    let restored2dLayer = new ImageData(stageSize.width, stageSize.height)
    let dataArray = jsonStage.stage2dLayer
    restored2dLayer.data.set(dataArray)

    reDrawVectorLayer(
      { x: 0, y: 0 },
      stageSize,
      stageSize,
      jsonStage.stageVectorLayer
    )

    reDraw2dLayer(restored2dLayer, { x: 0, y: 0 })

    let layerSize = { wdith: stageSize.width, height: stageSize.height }
    loadCurveLayer(jsonStage.stageCurveLayer, layerSize)

    reDrawCurveLayer({ x: 0, y: 0 }, layerSize, layerSize)

    graphVisible = jsonStage.stageData.graphVisible
    toggleGrid(graphVisible ? 'on' : 'off')
  }
}

function loadCurveLayer(stageCurveLayer, layerSize) {
  bezShapes = stageCurveLayer[0]
  bezShapeCount = bezShapes.length - 1
  restoreCircleArray(stageCurveLayer[1])

  for (let w = 1; w < bezShapes.length; w++) {
    for (let x = 1; x < bezShapes[w].bezPoints.length; x++) {
      drawPoint(w, x, {
        x: bezShapes[w].bezPoints[x].x,
        y: bezShapes[w].bezPoints[x].y,
      })
    }
  }

  reDrawCurveLayer({ x: 0, y: 0 }, layerSize, layerSize)
}
