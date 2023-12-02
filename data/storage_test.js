// ===========================================================================
// Testing
// ===========================================================================

let userInput = document.querySelector("#event");
let eventButton = document.getElementById("eventButton");
eventButton.addEventListener("click", function(e){
  e.preventDefault();
  StoreEvent(userInput.value, "none","test")
  updatePage()
});


function updatePage() {
  document.querySelector("#dumps").textContent = dumpCount;
  document.querySelector("#events").textContent = getStorageEventCount();
  document.querySelector("#metricSetsStored").textContent = getStorageMetricCount();
  document.querySelector("#metrics").textContent = metrics.length
}

setInterval(testHandler, 63)
function testHandler() {
  StoreMetric("test", 100)
  updatePage()
}
