/* Author: Patrick Lundquist
 * Date:   2023-12-01
 *
 * This file contains functions used for storing events and metrics data.
 *
 */

// If true, use browser localStorage. Otherwise use sessionStorage.
let localStorageEnabled = true;

// Whether automatic dumping to file is enabled.
let autoDumpEnabled = true;

// Array of timeseries metrics.
let metrics = [];

// Number of dumps taken so far.
let dumpCount = 0;

// Threshold for metrics before storing to browser storage.
const maxMetrics = 1000;

// Threshold browser storage entries to trigger an automatic dump to file.
const maxStoredItems = 30;

// Key used for storing events in browser storage.
const storageEventCountKey = "eventCount";

// Key used for storing metrics in browser storage.
const storageMetricCountKey = "metricCount";

// ===========================================================================
// Setup
// ===========================================================================

// Handle dump button.
let dumpStorageButton = document.getElementById("dumpStorageButton");
dumpStorageButton.addEventListener("click", function(e){
  e.preventDefault();
  console.log("User triggered storage dump to disk.")
  // Flush any outstanding metrics, then dump to disk.
  if (metrics.length > 0 ) {
    flushMetricsToStorage()
  }
  dumpStorageToDisk((new Date()).getTime())
});

// ===========================================================================
// Public Functions
// ===========================================================================

// Store event to storage.
// 'type' is a string identifying the event.
// 'url' is the string url, if any.
// 'val' is a string of the result message.
function StoreEvent(type, url, val) {
  console.log("Storing event to storage...")
  curTs = (new Date()).getTime()
  var item = {
    ts : curTs,
    type: type,
    url: url,
    value : val
  }
  key = getStorageEventCount()
  addItemToStorage(
    getEventStorageKey(key), JSON.stringify(item));
  incrementStorageEventCount();
}

// Store metric in array and flush to storage if beyond a threshold.
// 'type' is a string identifying the metric.
// 'val' is a numeric value.
function StoreMetric(type, val) {
  curTs = (new Date()).getTime()
  var entry = {
    ts : curTs,
    type: type,
    value : val
  }
  metrics.push(entry);

  if (metrics.length < maxMetrics) {
    return;
  }
  // metrics is full, so flush to storage.
  flushMetricsToStorage()
}

// ===========================================================================
// Get/set/remove abstractions and convenience functions.
// ===========================================================================

function getMetricStorageKey(num) {
    return "metric-" + String(num)
}

function getEventStorageKey(num) {
    return "event-" + String(num)
}

function getStorageEventCount() {
  count = parseInt(getItemFromStorage(storageEventCountKey))
  if (isNaN(count)) {
    return 0;
  }
  return count;
}

function getStorageMetricCount() {
  count = parseInt(getItemFromStorage(storageMetricCountKey))
  if (isNaN(count)) {
    return 0;
  }
  return count;
}

function incrementStorageEventCount() {
  count = getStorageEventCount();
  count += 1;
  setStorageEventCount(count)
}

function incrementStorageMetricCount() {
  count = getStorageMetricCount();
  count += 1;
  setStorageMetricCount(count)
}

function getItemFromStorage(key) {
  if (localStorageEnabled) {
    return localStorage.getItem(key)
  } else {
    return sessionStorage.getItem(key)
  }
}

function removeItemFromStorage(key) {
  if (localStorageEnabled) {
    localStorage.removeItem(key)
  } else {
    sessionStorage.removeItem(key)
  }
}

function addItemToStorage(key, val) {
  // TODO: check if storage is full and we need to evict old value(s).
  if (localStorageEnabled) {
    localStorage.setItem(key, val)
  } else {
    sessionStorage.setItem(key, val)
  }
}

function setStorageEventCount(val) {
  addItemToStorage(storageEventCountKey, val)
}

function setStorageMetricCount(val) {
  addItemToStorage(storageMetricCountKey, val)
}

// ===========================================================================
// Private functions
// ===========================================================================

// download creates a temporary anchor link to facilitate dumping to disk.
const download = (path, filename) => {
    // Create a new link
    const anchor = document.createElement('a');
    anchor.href = path;
    anchor.download = filename;

    // Append to the DOM
    document.body.appendChild(anchor);

    // Trigger `click` event
    anchor.click();

    // Remove element from DOM
    document.body.removeChild(anchor);
};

function flushMetricsToStorage() {
  console.log("Flushing metrics to storage...")
  var item = {
    value : metrics
  }
  key = getStorageMetricCount()
  addItemToStorage(getMetricStorageKey(key), JSON.stringify(item))
  incrementStorageMetricCount();
  metrics = [];
}

function maybeDumpToDisk() {
  if (getStorageEventCount() >= maxEventItems) {
    console.log("Events exceed max threshold.")
    if (autoDumpEnabled) {
      dumpStorageToDisk(curTs)
    }
  }

  if (getStorageMetricCount() + getStorageEventCount() >= maxStorageItems) {
    console.log("Stored items exceed max threshold.")
    if (autoDumpEnabled) {
      dumpStorageToDisk(curTs)
    }
  }
}

function dumpStorageToDisk(ts) {
  console.log("Dumping stored items to disk...")
  // Read all storage entries and create a json blob.
  var jsonData = {
    events : [],
    metrics: [],
  }
  // Add metrics from storage.
  for (let i = 0; i < getStorageMetricCount(); i++) {
    let item = getItemFromStorage(getMetricStorageKey(i))
    jsonData.metrics.push(item)
  }

  // Add events from storage.
  for (let i = 0; i < getStorageEventCount(); i++) {
    let item = getItemFromStorage(getEventStorageKey(i))
    jsonData.events.push(item)
  }

  // Convert JSON to string.
  const data = JSON.stringify(jsonData);

  // Create a Blob object.
  const blob = new Blob([data], { type: 'application/json' });

  // Create an object URL.
  const url = URL.createObjectURL(blob);

  // Download it. File format:
  // dump_<dumpCount>_events_<numEvents>_metrics_<numMetrics>_ts_<ts>.json
  dumpFileName = "dump_" + dumpCount +
    "_events_" + getStorageEventCount() +
    "_metrics" + getStorageMetricCount() +
    "_ts_" + ts + ".json"
  download(url, dumpFileName);

  dumpCount += 1;

  // Release object URL.
  URL.revokeObjectURL(url);

  // Clear Storage for metrics.
  for (let i = 0; i < getStorageMetricCount(); i++) {
    removeItemFromStorage(getMetricStorageKey(i))
  }
  setStorageMetricCount(0);

  // Clear Storage for events.
  for (let i = 0; i < getStorageEventCount(); i++) {
    removeItemFromStorage(getEventStorageKey(i))
  }
  setStorageEventCount(0);
}
