function updateContainerSize(newHieght, newWidth) {
  document.getElementById('container').style.height = newHieght
  document.getElementById('container').style.width = newWidth
  document.getElementById('horizontal-slider').style.width = newWidth
  document.getElementById('vertical-slider').style.width = newHieght
}

function getNewContainerDimensions(newHeight, newWidth) {
  let maxDimensions = getMaxHeightWidth()
  let minimumThreshold = 0.25

  globalHScale = 1
  globalWScale = 1

  if (maxDimensions.width < newWidth && maxDimensions.height >= newHeight) {
    globalWScale = maxDimensions.width / newWidth
    if (globalWScale >= minimumThreshold) {
      newHeight = newHeight * globalWScale
      newWidth = maxDimensions.width
      globalHScale = globalWScale
    }
  } else if (
    maxDimensions.height < newHeight &&
    maxDimensions.width >= newWidth
  ) {
    globalHScale = maxDimensions.height / newHeight
    if (globalHScale >= minimumThreshold) {
      newWidth = newWidth * globalHScale
      newHeight = maxDimensions.height
      globalWScale = globalHScale
    }
  } else if (
    maxDimensions.height < newHeight &&
    maxDimensions.width < newWidth
  ) {
    globalWScale = maxDimensions.width / newWidth
    globalHScale = maxDimensions.height / newHeight

    if (globalHScale < globalWScale) {
      if (globalHScale >= minimumThreshold) {
        globalWScale = globalHScale
        newWidth = newWidth * globalWScale
      }
    } else if (globalWScale < globalHScale) {
      if (globalWScale >= minimumThreshold) {
        globalHScale = globalWScale
        newHeight = newHeight * globalHScale
      }
    }
  }

  return { height: newHeight, width: newWidth }
}

function getMaxHeightWidth() {
  let container = document.getElementById('container-background')
  let slideContainer = document.getElementById('horizontal-slider')

  // shrink the available space by 0.025 to give a slight margin and to prevent scroll bars
  // Allow 100px for slider width
  return {
    height: container.clientHeight - container.clientHeight * 0.025 - 100,
    width: container.clientWidth - container.clientWidth * 0.025 - 100,
  }
}
