
const languageApi = require("./DAL/languageApi");
const japaneseToEnglishSplatoonApi = require("./DAL/japaneseToEnglishSplatoonApi");

let text = `これは「スクイックリンα」。
軽量級のチャージャーで、チャージ速度がかなり速く、空中でもチャージ速度が落ちないという特徴を持つ。
その分、チャージャーの中では飛距離が短いので、機動力を駆使して戦おう。
後部にあるタンクがバンカラ地方の洗剤ブランドのものに変わっているぞ。`;

(async () => {
    console.log(await languageApi.translateText(japaneseToEnglishSplatoonApi.swapAll(text)));
})();