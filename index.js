const postcss = require('postcss');
const resolveImportUrls = require('postcss-import-url');
const resolveLocalImports = require('postcss-import');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const fs = require('fs/promises');
const path = require('path');
const https = require('https')
const axios = require('axios');
require('dotenv').config();

if(!process.env.STYLE_PATH) {
  console.error("[e] STYLE_PATH env variable not set.");
  return;
}
if(!process.env.JELLYFIN_BASE_URL) {
  console.error("[e] JELLYFIN_BASE_URL env variable not set.");
  return;
}
if(!process.env.JELLYFIN_API_KEY) {
  console.error("[e] JELLYFIN_API_KEY env variable not set.");
  return;
}

const STYLE_PATH = path.resolve(process.env.STYLE_PATH);
const JELLYFIN_BASE_URL = process.env.JELLYFIN_BASE_URL.endsWith("/") ? process.env.JELLYFIN_BASE_URL.slice(0,-1)
                                                                      : process.env.JELLYFIN_BASE_URL;
const JELLYFIN_API_KEY = process.env.JELLYFIN_API_KEY;


(async () =>{
  try {
    const axiosInstance = axios.create({
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      }),
      headers: {
        'X-MediaBrowser-Token': JELLYFIN_API_KEY
      }
    });

    console.log("[i] Reading source css file...");
    const originalCss = await fs.readFile(STYLE_PATH);
    if(!originalCss) {
      throw new Error("Empty original css!");
    }

    console.log("[i] Transpiling the CSS...");
    const transpilationResult = await postcss([resolveLocalImports(),
                                               resolveImportUrls(), 
                                               autoprefixer(), 
                                               cssnano({preset: 'default'})]).process(originalCss, {from: STYLE_PATH});
    
    console.log("[i] Fetching current branding preferences...");
    const brandingUrl = JELLYFIN_BASE_URL + '/System/Configuration/branding';
    let res = await axiosInstance.get(brandingUrl);
    const preferences = res.data;
    if(!preferences) {
      throw new Error("Preferences missing!");
    }
    
    console.log("[i] Updating branding preferences...");
    const updatedPreferences = {
      ...preferences,
      CustomCss: transpilationResult.css
    };
    res = await axiosInstance.post(brandingUrl, updatedPreferences);

    console.log(`[i] Success, response status: ${res.status}`);
    return;
  } catch (error) {
    console.error(error);
    console.error("[e] Oops, a failure. :/");
    
    return;
  }

})();


