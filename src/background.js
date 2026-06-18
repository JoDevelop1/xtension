const extensionApi = globalThis.chrome || globalThis.browser;
const runtimeApi = extensionApi?.runtime;

runtimeApi.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) {
    return false;
  }

  if (message.type === "xtension-fetch-image") {
    fetchImageAsDataUrl(message.url).then((image) => {
      sendResponse({
        ok: true,
        image
      });
    }).catch((error) => {
      sendResponse({
        ok: false,
        error: error.message
      });
    });

    return true;
  }

  return false;
});

async function fetchImageAsDataUrl(url) {
  const response = await fetch(url, {
    cache: "force-cache",
    credentials: "omit"
  });

  if (!response.ok) {
    throw new Error(`Image ${response.status}`);
  }

  const mimeType = response.headers.get("content-type") || "application/octet-stream";
  const bytes = new Uint8Array(await response.arrayBuffer());

  return {
    mimeType,
    dataUrl: `data:${mimeType};base64,${uint8ArrayToBase64(bytes)}`
  };
}

function uint8ArrayToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}
