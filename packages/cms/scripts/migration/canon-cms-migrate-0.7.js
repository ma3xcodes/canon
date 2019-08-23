#! /usr/bin/env node
 
const utils = require("./migrationUtils.js");
const {catcher, resetSequence, fetchOldModel, fetchNewModel} = utils;

const sectionInclude = [
  {association: "descriptions", separate: true},
  {association: "subtitles", separate: true},
  {association: "stats", separate: true},
  {association: "visualizations", separate: true}
];

const locale = process.env.CANON_LANGUAGE_DEFAULT || "en";

const migrate = async() => {

  const dbold = await fetchOldModel("/db_0.7", false);
  const dbnew = await fetchNewModel("/db_0.8", true);

  // The order of this migration matters - Many tables have FK dependencies, so the tables must be created in order.
  const migrationMap = [
    // These ones have no dependencies and can be copied wholesale
    {old: "formatter", new: "formatter"},
    {old: "images", new: "image"},  // Note that the image table is now singular, to match the rest of the tables.
    {old: "search", new: "search"},
    // Profile 
    {old: "profile", new: "profile"},
    {old: "profile_content", new: "profile_content"},
    {old: "profile_meta", new: "profile_meta"},
    {old: "generator", new: "generator"},
    {old: "materializer", new: "materializer"},
    // Section
    {old: "section", new: "section"},
    {old: "section_content", new: "section_content"},
    {old: "section_description", new: "section_description"},
    {old: "section_description_content", new: "section_description_content"},
    {old: "section_stat", new: "section_stat"},
    {old: "section_stat_content", new: "section_stat_content"},
    {old: "section_subtitle", new: "section_subtitle"},
    {old: "section_subtitle_content", new: "section_subtitle_content"},
    {old: "section_visualization", new: "section_visualization"},
    // Story
    {old: "story", new: "story"},
    {old: "story_content", new: "story_content"},
    {old: "story_description", new: "story_description"},
    {old: "story_description_content", new: "story_description_content"},
    {old: "story_footnote", new: "story_footnote"},
    {old: "story_footnote_content", new: "story_footnote_content"},
    // Storysection -> Storysection
    {old: "storysection", new: "storysection"},
    {old: "storysection_content", new: "storysection_content"},
    {old: "storysection_description", new: "storysection_description"},
    {old: "storysection_description_content", new: "storysection_description_content"},
    {old: "storysection_stat", new: "storysection_stat"},
    {old: "storysection_stat_content", new: "storysection_stat_content"},
    {old: "storysection_subtitle", new: "storysection_subtitle"},
    {old: "storysection_subtitle_content", new: "storysection_subtitle_content"},
    {old: "storysection_visualization", new: "storysection_visualization"}
  ];

  for (const tableObj of migrationMap) {
    let oldrows = await dbold[tableObj.old].findAll();
    oldrows = oldrows.map(row => row.toJSON());
    for (const oldrow of oldrows) {
      oldrow = oldrow.toJSON();
      if (oldrow.lang) {
        oldrow.locale = oldrow.lang;
        delete oldrow.lang;
      }
    }
    await dbnew[tableObj.new].bulkCreate(oldrows).catch(catcher);
    await resetSequence(dbnew, tableObj.new, "id");
    for (const oldrow of oldrows) {
      if (tableObj.old === "images") {
        const {id, meta} = oldrow;
        if (meta) await dbnew.image_content.create({id, locale, meta}).catch(catcher);
      }
      if (tableObj.old === "search") {
        const {id, dimension, hierarchy, keywords} = oldrow;
        const newRow = await dbnew.search.findOne({where: {id, dimension, hierarchy}}).catch(catcher);
        const {contentId} = newRow;
        if (oldrow.name) await dbnew.search_content.create({id: contentId, locale, name, keywords});
      }
    }
  }

  console.log("Done.");
};

// migrate();

return;
