/**
 * The CMS makes large, hierarchical gets, necessitating complex include-trees. Stubs for those trees are included here,
 * Along with some helper arrays that feed into cmsRoute to help dynamically define CRUD actions.
 */

const profileReqFull = {
  include: [
    {association: "meta", separate: true},
    {association: "content", separate: true},
    {association: "generators", separate: true},
    {association: "materializers", separate: true},
    {association: "selectors", separate: true},
    {
      association: "sections", separate: true,
      include: [
        {association: "content", separate: true},
        {association: "subtitles", include: [{association: "content", separate: true}], separate: true},
        {association: "descriptions", include: [{association: "content", separate: true}], separate: true},
        {association: "stats", include: [{association: "content", separate: true}], separate: true},
        {association: "visualizations", separate: true},
        {association: "selectors"}
      ]
    }
  ]
};

const storyReqFull = {
  include: [
    {association: "content", separate: true},
    {association: "storygenerators", separate: true},
    {association: "storymaterializers", separate: true},
    {association: "storyselectors", separate: true},
    {association: "authors", include: [{association: "content", separate: true}], separate: true},
    {association: "descriptions", include: [{association: "content", separate: true}], separate: true},
    {association: "footnotes", include: [{association: "content", separate: true}], separate: true},
    {
      association: "storysections", separate: true,
      include: [
        {association: "content", separate: true},
        {association: "subtitles", include: [{association: "content", separate: true}], separate: true},
        {association: "descriptions", include: [{association: "content", separate: true}], separate: true},
        {association: "stats", include: [{association: "content", separate: true}], separate: true},
        {association: "visualizations", separate: true}
      ]
    }
  ]
};

const sectionReqFull = {
  include: [
    {association: "content", separate: true},
    {association: "subtitles", include: [{association: "content", separate: true}], separate: true},
    {association: "descriptions", include: [{association: "content", separate: true}], separate: true},
    {association: "stats", include: [{association: "content", separate: true}], separate: true},
    {association: "visualizations", separate: true},
    {association: "selectors"}
  ]
};

const storysectionReqFull = {
  include: [
    {association: "content", separate: true},
    {association: "subtitles", include: [{association: "content", separate: true}], separate: true},
    {association: "descriptions", include: [{association: "content", separate: true}], separate: true},
    {association: "stats", include: [{association: "content", separate: true}], separate: true},
    {association: "visualizations", separate: true}
  ]
};

/**
 * API paths are dynamically generated by folding over this list in the get/post methods that follow.
 * IMPORTANT: When new tables are added to the CMS, adding their exact tablename to this list will
 * automatically generate Create, Update, and Delete Routes (as specified later in the get/post methods)
 */
const cmsTables = [
  "author", "formatter", "generator", "materializer", "profile", "profile_meta",
  "selector", "story", "story_description", "story_footnote", "storysection",
  "storysection_description", "storysection_stat", "storysection_subtitle", "storysection_visualization",
  "section", "section_description", "section_stat", "section_subtitle", "section_visualization", "section_selector"
];

/**
 * Some tables are translated to different languages using a corresponding "content" table, like "profile_content".
 * As such, some of the following functions need to take compound actions, e.g., insert a metadata record into
 * profile, THEN insert the "real" data into "profile_content." This list (subset of cmsTables) represents those
 * tables that need corresponding _content updates.
 */

const contentTables = [
  "author", "profile", "story", "story_description", "story_footnote", "storysection", "storysection_description",
  "storysection_stat", "storysection_subtitle", "section", "section_description", "section_stat", "section_subtitle"
];

/**
 * Some tables need to know their own parents, for help with ordering. This lookup table allows
 * a given id to find its "siblings" and know where it belongs, ordering-wise
 */

const parentOrderingTables = {
  author: "story_id",
  materializer: "profile_id",
  profile_meta: "profile_id",
  section: "profile_id",
  section_description: "section_id",
  section_selector: "section_id",
  section_stat: "section_id",
  section_subtitle: "section_id",
  section_visualization: "section_id",
  story_description: "story_id",
  story_footnote: "story_id",
  storysection: "story_id",
  storysection_description: "storysection_id",
  storysection_stat: "storysection_id",
  storysection_subtitle: "storysection_id",
  storysection_visualization: "storysection_id"
};

module.exports = {profileReqFull, storyReqFull, sectionReqFull, storysectionReqFull, cmsTables, contentTables, parentOrderingTables};
