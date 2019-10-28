const Client = require("@datawheel/olap-client").Client;
const MondrianDataSource = require("@datawheel/olap-client").MondrianDataSource;
// const TesseractDataSource = require("@datawheel/olap-client").TesseractDataSource;

const collate = require("../utils/collate");
const d3Array = require("d3-array");
const sequelize = require("sequelize");
const shell = require("shelljs");
const yn = require("yn");
const path = require("path");
const {strip} = require("d3plus-text");
const Op = sequelize.Op;

const envLoc = process.env.CANON_LANGUAGE_DEFAULT || "en";
const verbose = yn(process.env.CANON_CMS_LOGGING);
const LANGUAGES = process.env.CANON_LANGUAGES ? process.env.CANON_LANGUAGES.split(",") : [envLoc];
if (!LANGUAGES.includes(envLoc)) LANGUAGES.push(envLoc);
// Put the default language first in the array. This ensures that slugs that are generated
// in populateSearch will be made from the default language content.
LANGUAGES.sort(a => a === envLoc ? -1 : 1);

const {CANON_CMS_CUBES} = process.env;

/**
 * There is not a fully-featured way for olap-client to know the difference between a 
 * Tesseract and a Mondrian Client. Tesseract is more modern/nice in its HTTP codes/responses,
 * so attempt Tesseract first, and on failure, assume mondrian. 
 */
const client = new Client();
Client.dataSourceFromURL(CANON_CMS_CUBES).then(
  datasource => {
    if (verbose) console.log(`Initializing Tesseract at ${CANON_CMS_CUBES}`);
    client.setDataSource(datasource);
  },
  err => {
    const ds = new MondrianDataSource(CANON_CMS_CUBES);
    client.setDataSource(ds);
    if (verbose) console.error(`Tesseract not detected: ${err.message}`);
    if (verbose) console.log(`Initializing Mondrian at ${CANON_CMS_CUBES}`);
  }
);

const sectionTypeDir = path.join(__dirname, "../components/sections/");

const cmsCheck = () => process.env.NODE_ENV === "development" || yn(process.env.CANON_CMS_ENABLE);

const isEnabled = (req, res, next) => {
  if (cmsCheck()) return next();
  return res.status(401).send("Not Authorized");
};

const catcher = e => {
  if (verbose) {
    console.error("Error in cmsRoute: ", e);
  }
  return [];
};

const profileReqFull = {
  include: [
    {association: "meta"},
    {association: "content"},
    {association: "generators"},
    {association: "materializers"},
    {association: "selectors"},
    {
      association: "sections",
      include: [
        {association: "content"},
        {association: "subtitles", include: [{association: "content"}]},
        {association: "descriptions", include: [{association: "content"}]},
        {association: "stats", include: [{association: "content"}]},
        {association: "visualizations"},
        {association: "selectors"}
      ]
    }
  ]
};

const storyReqTreeOnly = {
  attributes: ["id", "slug", "ordering"],
  include: [
    {association: "content", attributes: ["id", "locale", "title"]},
    {association: "storysections", attributes: ["id", "slug", "ordering", "story_id", "type"],
      include: [{association: "content", attributes: ["id", "locale", "title"]}]
    }
  ]
};

const profileReqProfileOnly = {
  include: [
    {association: "meta"},
    {association: "content"}
  ]
};

const storyReqStoryOnly = {
  include: [
    {association: "content"},
    {association: "authors", attributes: ["id", "ordering"]},
    {association: "descriptions", attributes: ["id", "ordering"]},
    {association: "footnotes", attributes: ["id", "ordering"]}
  ]
};

const sectionReqSectionOnly = {
  include: [
    {association: "content"},
    {association: "subtitles", attributes: ["id", "ordering"]},
    {association: "descriptions", attributes: ["id", "ordering"]},
    {association: "visualizations", attributes: ["id", "ordering"]},
    {association: "stats", attributes: ["id", "ordering"]},
    {association: "selectors"}
  ]
};

const storysectionReqStorysectionOnly = {
  include: [
    {association: "content"},
    {association: "subtitles", attributes: ["id", "ordering"]},
    {association: "descriptions", attributes: ["id", "ordering"]},
    {association: "visualizations", attributes: ["id", "ordering"]},
    {association: "stats", attributes: ["id", "ordering"]}
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

const sorter = (a, b) => a.ordering - b.ordering;

/**
 * Due to yet-unreproducible edge cases, sometimes elements lose their ordering.
 * This function sorts an array, then checks if the "ordering" property lines up
 * with the element's place in the array. If not, "patch" the element and send it back
 * to the client, and asynchronously send an update to the db to match it.
 */
const flatSort = (conn, array) => {
  if (!array) return [];
  array.sort(sorter).map((o, i) => {
    if (o.ordering !== i) {
      o.ordering = i;
      conn.update({ordering: i}, {where: {id: o.id}});
    }
    return o;
  });
  return array;
};

const bubbleSortSelectors = (conn, selectors) => {
  selectors = selectors
    .map(s => Object.assign({}, s, {ordering: s.section_selector.ordering}))
    .sort(sorter);
  selectors.forEach((o, i) => {
    if (o.ordering !== i) {
      o.ordering = i;
      o.section_selector.ordering = i;
      conn.update({ordering: i}, {where: {id: o.section_selector.id}}).catch(catcher);
    }
  });
  return selectors;
};


// Using nested ORDER BY in the massive includes is incredibly difficult so do it manually here. todo: move it up to the query.
const sortProfileTree = (db, profiles) => {
  profiles = profiles.map(p => p.toJSON());
  profiles = flatSort(db.profile, profiles);
  profiles.forEach(p => {
    p.meta = flatSort(db.profile_meta, p.meta);
    p.sections = flatSort(db.section, p.sections);
  });
  return profiles;
};

const sortStoryTree = (db, stories) => {
  stories = stories.map(s => s.toJSON());
  stories = flatSort(db.story, stories);
  stories.forEach(s => {
    s.storysections = flatSort(db.storysection, s.storysections);
  });
  return stories;
};

const sortProfile = (db, profile) => {
  profile.meta = flatSort(db.profile_meta, profile.meta);
  profile.materializers = flatSort(db.materializer, profile.materializers);
  return profile;
};

const sortStory = (db, story) => {
  story = story.toJSON();
  story.descriptions = flatSort(db.story_description, story.descriptions);
  story.footnotes = flatSort(db.story_footnote, story.footnotes);
  story.authors = flatSort(db.author, story.authors);
  return story;
};

const sortSection = (db, section) => {
  section.subtitles = flatSort(db.section_subtitle, section.subtitles);
  section.visualizations = flatSort(db.section_visualization, section.visualizations);
  section.stats = flatSort(db.section_stat, section.stats);
  section.descriptions = flatSort(db.section_description, section.descriptions);
  // ordering is nested in section_selector - bubble for top-level sorting
  section.selectors = bubbleSortSelectors(db.section_selector, section.selectors);
  return section;
};

const sortStorySection = (db, storysection) => {
  storysection = storysection.toJSON();
  storysection.subtitles = flatSort(db.storysection_subtitle, storysection.subtitles);
  storysection.visualizations = flatSort(db.storysection_visualization, storysection.visualizations);
  storysection.stats = flatSort(db.storysection_stat, storysection.stats);
  storysection.descriptions = flatSort(db.storysection_description, storysection.descriptions);
  return storysection;
};

const getSectionTypes = () => {
  const sectionTypes = [];
  shell.ls(`${sectionTypeDir}*.jsx`).forEach(file => {
    // In Windows, the shell.ls command returns forward-slash separated directories,
    // but the node "path" command returns backslash separated directories. Flip the slashes
    // so the ensuing replace operation works (this should be a no-op for *nix/osx systems)
    const sectionTypeDirFixed = sectionTypeDir.replace(/\\/g, "/");
    const compName = file.replace(sectionTypeDirFixed, "").replace(".jsx", "");
    if (compName !== "Section") sectionTypes.push(compName);
  });
  return sectionTypes;
};

const formatter = (members, data, dimension, level) => {

  const newData = members.reduce((arr, d) => {
    const obj = {};
    obj.id = `${d.key}`;
    obj.name = d.caption || d.name;
    obj.zvalue = data[obj.id] || 0;
    obj.dimension = dimension;
    obj.hierarchy = level;
    obj.stem = -1;
    arr.push(obj);
    return arr;
  }, []);
  const st = d3Array.deviation(newData, d => d.zvalue);
  const average = d3Array.median(newData, d => d.zvalue);
  newData.forEach(d => d.zvalue = (d.zvalue - average) / st);
  return newData;
};

const pruneSearch = async(dimension, levels, db) => {
  const currentMeta = await db.profile_meta.findAll().catch(catcher);
  const currentDimensions = currentMeta.map(m => m.dimension);
  // To be on the safe side, only clear the search table of dimensions that NO remaining
  // profiles are currently making use of.
  // Don't need to prune levels - they will be filtered automatically in searches.
  // If it gets unwieldy in size however, an optimization could be made here
  if (!currentDimensions.includes(dimension)) {
    const resp = await db.search.destroy({where: {dimension}}).catch(catcher);
    if (verbose) console.log(`Cleaned up search data. Rows affected: ${resp}`);
  }
  else {
    if (verbose) console.log(`Skipped search cleanup - ${dimension} is still in use`);
  }
};

const populateSearch = async(profileData, db) => {

  const cubeName = profileData.cubeName;
  const measure = profileData.measure;
  const dimension = profileData.dimName || profileData.dimension;
  const dimLevels = profileData.levels;

  const cube = await client.getCube(cubeName).catch(catcher);

  const levels = cube.dimensionsByName[dimension].hierarchies[0].levels
    .filter(l => l.name !== "(All)" && dimLevels.includes(l.name));

  for (const locale of LANGUAGES) {

    let fullList = [];
    for (let i = 0; i < levels.length; i++) {

      const level = levels[i];
      const members = await client.getMembers(level, {locale}).catch(catcher);

      let data = [];

      const drilldown = {
        dimension,
        hierarchy: level.hierarchy.name,
        level: level.name
      };

      data = await client.execQuery(cube.query
        .addDrilldown(drilldown)
        .addMeasure(measure))
        .then(resp => resp.data)
        .then(data => data.reduce((obj, d) => {
          obj[d[`ID ${level.name}`] ? d[`ID ${level.name}`] : d[`${level.name} ID`]] = d[measure];
          return obj;
        }, {})).catch(catcher);

      fullList = fullList.concat(formatter(members, data, dimension, level.name));

    }

    let slugs = await db.search.findAll().catch(catcher);
    slugs = slugs.map(s => s.slug).filter(d => d);

    const slugify = (str, id) => {
      let slug = strip(str).replace(/-{2,}/g, "-").toLowerCase();
      if (slugs.includes(slug)) slug += `-${id}`;
      slugs.push(slug);
      return slug;
    };

    // Fold over the list of members
    for (let i = 0; i < fullList.length; i++) {
      // Extract their properties
      const {id, name, zvalue, dimension, hierarchy, stem} = fullList[i];
      // The search table holds the non-translatable props
      const searchObj = {id, zvalue, dimension, hierarchy, stem};
      searchObj.slug = slugify(name, id);
      // Create the member in the search table
      const [row, created] = await db.search.findOrCreate({
        where: {id, dimension, hierarchy},
        defaults: searchObj
      }).catch(catcher);
      if (created) {
        if (verbose) console.log(`Created: ${row.id} ${row.slug}`);
        // If a new row was created, create its translated content
        await db.search_content.create({id: row.contentId, locale, name});
      }
      else {
        if (row.slug) delete searchObj.slug;
        // If it's an update, update everything except the (permanent) slug
        await row.updateAttributes(searchObj).catch(catcher);
        if (verbose) {
          console.log(`Updated: ${row.id} ${row.slug}`);
          console.log("Updating associated language content:");
        }
        const [contentRow, contentCreated] = await db.search_content.findOrCreate({
          where: {id: row.contentId, locale},
          defaults: {name}
        }).catch(catcher);
        if (contentCreated) {
          if (verbose) console.log(`Created ${locale} Content: ${contentRow.name}`);
        }
        else {
          await contentRow.updateAttributes({name});
          if (verbose) console.log(`Updated ${contentRow.id} ${contentRow.locale}: ${contentRow.name}`);
        }
      }
    }
  }

};

module.exports = function(app) {

  const {db} = app.settings;

  app.get("/api/cms", (req, res) => res.json(cmsCheck()));

  /* BASIC GETS */

  // Top-level tables have their own special gets, so exclude them from the "simple" gets
  const getList = cmsTables.filter(tableName =>
    !["profile", "section", "story", "storysection"].includes(tableName)
  );

  getList.forEach(ref => {
    app.get(`/api/cms/${ref}/get/:id`, async(req, res) => {
      if (contentTables.includes(ref)) {
        const u = await db[ref].findOne({where: {id: req.params.id}, include: {association: "content"}}).catch(catcher);
        return res.json(u);
      }
      else {
        const u = await db[ref].findOne({where: {id: req.params.id}}).catch(catcher);
        return res.json(u);
      }
    });
  });

  app.get("/api/cms/meta", async(req, res) => {
    let meta = await db.profile_meta.findAll().catch(catcher);
    meta = meta.map(m => m.toJSON());
    for (const m of meta) {
      m.top = await db.search.findOne({where: {dimension: m.dimension}, order: [["zvalue", "DESC"]], limit: 1}).catch(catcher);
    }
    res.json(meta);
  });

  app.get("/api/cms/tree", async(req, res) => {
    let profiles = await db.profile.findAll(profileReqFull).catch(catcher);
    profiles = sortProfileTree(db, profiles);
    const sectionTypes = getSectionTypes();
    profiles.forEach(profile => {
      profile.sections = profile.sections.map(section => {
        section = sortSection(db, section);
        section.types = sectionTypes;
        return section;
      });
      return profile;
    });
    return res.json(profiles);
  });

  app.get("/api/cms/formatter", async(req, res) => {
    const formatters = await db.formatter.findAll().catch(catcher);
    res.json(formatters);
  });

  app.get("/api/cms/storytree", async(req, res) => {
    let stories = await db.story.findAll(storyReqTreeOnly).catch(catcher);
    stories = sortStoryTree(db, stories);
    return res.json(stories);
  });

  app.get("/api/cms/profile/get/:id", async(req, res) => {
    const {id} = req.params;
    const dims = collate(req.query);
    const reqObj = Object.assign({}, profileReqProfileOnly, {where: {id}});
    let profile = await db.profile.findOne(reqObj).catch(catcher);
    profile = profile.toJSON();
    // Create a lookup object of the search rows, of the
    // pattern (id/id1),id2,id3, so that unary profiles can access it without an integer.
    let attr = {};
    for (let i = 0; i < dims.length; i++) {
      const dim = dims[i];
      const thisSlug = profile.meta.find(d => d.slug === dim.slug);
      const levels = thisSlug ? thisSlug.levels : [];
      let searchReq;
      if (levels.length === 0) {
        searchReq = {where: {id: dim.id}};
      }
      else {
        searchReq = {where: {[sequelize.Op.and]: [{id: dim.id}, {hierarchy: {[sequelize.Op.in]: levels}}]}};
      }
      let thisAttr = await db.search.findOne(searchReq).catch(catcher);
      thisAttr = thisAttr ? thisAttr.toJSON() : {};
      if (i === 0) attr = Object.assign(attr, thisAttr);
      Object.keys(thisAttr).forEach(key => {
        attr[`${key}${i + 1}`] = thisAttr[key];
      });
    }
    profile.attr = attr;
    return res.json(sortProfile(db, profile));
  });

  app.get("/api/cms/story/get/:id", async(req, res) => {
    const {id} = req.params;
    const reqObj = Object.assign({}, storyReqStoryOnly, {where: {id}});
    const story = await db.story.findOne(reqObj).catch(catcher);
    return res.json(sortStory(db, story));
  });

  app.get("/api/cms/storysection/get/:id", async(req, res) => {
    const {id} = req.params;
    const reqObj = Object.assign({}, storysectionReqStorysectionOnly, {where: {id}});
    let storysection = await db.storysection.findOne(reqObj).catch(catcher);
    const sectionTypes = [];
    shell.ls(`${sectionTypeDir}*.jsx`).forEach(file => {
      const compName = file.replace(sectionTypeDir, "").replace(".jsx", "");
      sectionTypes.push(compName);
    });
    storysection = sortStorySection(db, storysection);
    storysection.types = sectionTypes;
    return res.json(storysection);
  });

  /* BASIC INSERTS */
  const newList = cmsTables;
  newList.forEach(ref => {
    app.post(`/api/cms/${ref}/new`, isEnabled, async(req, res) => {
      if (parentOrderingTables[ref]) {
        const obj = {
          where: {[parentOrderingTables[ref]]: req.body[parentOrderingTables[ref]]},
          attributes: [[sequelize.fn("max", sequelize.col("ordering")), "max"]], 
          raw: true
        };
        const maxFetch = await db[ref].findAll(obj).catch(catcher);
        const ordering = typeof maxFetch[0].max === "number" ? maxFetch[0].max + 1 : 0;
        req.body.ordering = ordering;
      }
      // First, create the metadata object in the top-level table
      const newObj = await db[ref].create(req.body).catch(catcher);
      // For a certain subset of translated tables, we need to also insert a new, corresponding english content row.
      if (contentTables.includes(ref)) {
        const payload = Object.assign({}, req.body, {id: newObj.id, locale: envLoc});
        await db[`${ref}_content`].create(payload).catch(catcher);
        const fullObj = await db[ref].findOne({where: {id: newObj.id}, include: [{association: "content"}]}).catch(catcher);
        if (ref === "section") {
          fullObj.types = getSectionTypes();
        }
        return res.json(fullObj);
      }
      else {
        if (ref === "section_selector") {
          let selector = await db.selector.findOne({where: {id: req.body.selector_id}}).catch(catcher);
          selector = selector.toJSON();
          selector.section_selector = newObj.toJSON();
          return res.json(selector);
        }
        else {
          return res.json(newObj);  
        }
      }
    });
  });

  /* CUSTOM INSERTS */
  app.post("/api/cms/profile/newScaffold", isEnabled, async(req, res) => {
    const maxFetch = await db.profile.findAll({attributes: [[sequelize.fn("max", sequelize.col("ordering")), "max"]], raw: true}).catch(catcher);
    const ordering = typeof maxFetch[0].max === "number" ? maxFetch[0].max + 1 : 0;
    const profile = await db.profile.create({ordering}).catch(catcher);
    await db.profile_content.create({id: profile.id, locale: envLoc}).catch(catcher);
    const section = await db.section.create({ordering: 0, type: "Hero", profile_id: profile.id});
    await db.section_content.create({id: section.id, locale: envLoc}).catch(catcher);
    const reqObj = Object.assign({}, profileReqFull, {where: {id: profile.id}});
    let newProfile = await db.profile.findOne(reqObj).catch(catcher);
    newProfile = sortProfile(db, newProfile.toJSON()); 
    newProfile.sections = newProfile.sections.map(section => {
      section = sortSection(db, section);
      section.types = getSectionTypes();
      return section;
    });
    return res.json(newProfile);
  });

  app.post("/api/cms/profile/upsertDimension", isEnabled, async(req, res) => {
    const profileData = req.body;
    const {profile_id} = profileData;  // eslint-disable-line
    profileData.dimension = profileData.dimName;
    const oldmeta = await db.profile_meta.findOne({where: {id: profileData.id}}).catch(catcher);
    // Inserts are simple
    if (!oldmeta) {
      const maxFetch = await db.profile_meta.findAll({where: {profile_id}, attributes: [[sequelize.fn("max", sequelize.col("ordering")), "max"]], raw: true}).catch(catcher);
      const ordering = typeof maxFetch[0].max === "number" ? maxFetch[0].max + 1 : 0;
      profileData.ordering = ordering;
      await db.profile_meta.create(profileData);
      populateSearch(profileData, db);
    }
    // Updates are more complex - the user may have changed levels, or even modified the dimension
    // entirely. We have to prune the search before repopulating it.
    else {
      await db.profile_meta.update(profileData, {where: {id: profileData.id}});
      if (oldmeta.dimension !== profileData.dimension || oldmeta.levels.join() !== profileData.levels.join()) {
        pruneSearch(oldmeta.dimension, oldmeta.levels, db);
        populateSearch(profileData, db);
      }
    }
    const reqObj = Object.assign({}, profileReqFull, {where: {id: profile_id}});
    let newProfile = await db.profile.findOne(reqObj).catch(catcher);
    newProfile = sortProfile(db, newProfile.toJSON());
    newProfile.sections = newProfile.sections.map(section => {
      section = sortSection(db, section);
      section.types = getSectionTypes();
      return section;
    });
    return res.json(newProfile);
  });

  app.post("/api/cms/repopulateSearch", isEnabled, async(req, res) => {
    const {id} = req.body;
    let profileData = await db.profile_meta.findOne({where: {id}});
    profileData = profileData.toJSON();
    await populateSearch(profileData, db);
    return res.json({});
  });

  /* BASIC UPDATES */
  const updateList = cmsTables;
  updateList.forEach(ref => {
    app.post(`/api/cms/${ref}/update`, isEnabled, async(req, res) => {
      const {id} = req.body;
      await db[ref].update(req.body, {where: {id}}).catch(catcher);
      if (contentTables.includes(ref) && req.body.content) {
        for (const content of req.body.content) {
          await db[`${ref}_content`].upsert(content, {where: {id, locale: content.locale}}).catch(catcher);
        }
      }
      if (contentTables.includes(ref)) {
        const u = await db[ref].findOne({where: {id}, include: {association: "content"}}).catch(catcher);
        return res.json(u);
      }
      else {
        const u = await db[ref].findOne({where: {id}}).catch(catcher);
        return res.json(u);
      }
    });
  });

  /* SWAPS */
  /**
   * To handle swaps, this list contains objects with two properties. "elements" refers to the tables to be modified,
   * and "parent" refers to the foreign key that need be referenced in the associated where clause.
   */
  const swapList = [
    {elements: ["profile"], parent: null},
    {elements: ["author", "story_description", "story_footnote"], parent: "story_id"},
    {elements: ["section"], parent: "profile_id"},
    {elements: ["section_subtitle", "section_description", "section_stat", "section_visualization"], parent: "section_id"},
    {elements: ["storysection_subtitle", "storysection_description", "storysection_stat", "storysection_visualization"], parent: "storysection_id"}
  ];
  swapList.forEach(list => {
    list.elements.forEach(ref => {
      app.post(`/api/cms/${ref}/swap`, isEnabled, async(req, res) => {
        const {id} = req.body;
        const original = await db[ref].findOne({where: {id}}).catch(catcher);
        const otherWhere = {ordering: original.ordering + 1};
        if (list.parent) otherWhere[list.parent] = original[list.parent];
        const other = await db[ref].findOne({where: otherWhere}).catch(catcher);
        if (!original || !other) return res.json([]);
        const newOriginal = await db[ref].update({ordering: sequelize.literal("ordering + 1")}, {where: {id}, returning: true, plain: true}).catch(catcher);
        const newOther = await db[ref].update({ordering: sequelize.literal("ordering - 1")}, {where: {id: other.id}, returning: true, plain: true}).catch(catcher);
        return res.json([newOriginal[1], newOther[1]]);
      });
    });
  });

  /* CUSTOM SWAPS */

  app.post("/api/cms/section_selector/swap", isEnabled, async(req, res) => {
    const {id} = req.body;
    const original = await db.section_selector.findOne({where: {id}}).catch(catcher);
    const otherWhere = {ordering: original.ordering + 1, section_id: original.section_id};
    const other = await db.section_selector.findOne({where: otherWhere}).catch(catcher);
    await db.section_selector.update({ordering: sequelize.literal("ordering + 1")}, {where: {id}}).catch(catcher);
    await db.section_selector.update({ordering: sequelize.literal("ordering - 1")}, {where: {id: other.id}}).catch(catcher);
    const reqObj = Object.assign({}, sectionReqSectionOnly, {where: {id: original.section_id}});
    let section = await db.section.findOne(reqObj).catch(catcher);
    let rows = [];
    if (section) {
      section = section.toJSON();
      section.selectors = bubbleSortSelectors(db.section_selector, section.selectors);
      rows = section.selectors;
    }
    return res.json({parent_id: original.section_id, selectors: rows});
  });

  /* DELETES */
  /**
   * To streamline deletes, this list contains objects with two properties. "elements" refers to the tables to be modified,
   * and "parent" refers to the foreign key that need be referenced in the associated where clause.
   */
  const deleteList = [
    {elements: ["author", "story_description", "story_footnote"], parent: "story_id"},
    {elements: ["section_subtitle", "section_description", "section_stat", "section_visualization"], parent: "section_id"},
    {elements: ["storysection_subtitle", "storysection_description", "storysection_stat", "storysection_visualization"], parent: "storysection_id"}
  ];

  deleteList.forEach(list => {
    list.elements.forEach(ref => {
      app.delete(`/api/cms/${ref}/delete`, isEnabled, async(req, res) => {
        const row = await db[ref].findOne({where: {id: req.query.id}}).catch(catcher);
        // Construct a where clause that looks someting like: {profile_id: row.profile_id, ordering: {[Op.gt]: row.ordering}}
        // except "profile_id" is the "parent" in the array above
        const where1 = {ordering: {[Op.gt]: row.ordering}};
        where1[list.parent] = row[list.parent];
        await db[ref].update({ordering: sequelize.literal("ordering -1")}, {where: where1}).catch(catcher);
        await db[ref].destroy({where: {id: req.query.id}}).catch(catcher);
        const where2 = {};
        where2[list.parent] = row[list.parent];
        const reqObj = {where: where2, order: [["ordering", "ASC"]]};
        if (contentTables.includes(ref)) reqObj.include = {association: "content"};
        const rows = await db[ref].findAll(reqObj).catch(catcher);
        return res.json({parent_id: row[list.parent], newArray: rows});
      });
    });
  });

  /* CUSTOM DELETES */ 
  app.delete("/api/cms/generator/delete", isEnabled, async(req, res) => {
    const row = await db.generator.findOne({where: {id: req.query.id}}).catch(catcher);
    await db.generator.destroy({where: {id: req.query.id}});
    const generators = await db.generator.findAll({where: {profile_id: row.profile_id}}).catch(catcher);
    return res.json({id: req.query.id, parent_id: row.profile_id, generators});
  });

  app.delete("/api/cms/materializer/delete", isEnabled, async(req, res) => {
    const row = await db.materializer.findOne({where: {id: req.query.id}}).catch(catcher);
    await db.materializer.update({ordering: sequelize.literal("ordering -1")}, {where: {profile_id: row.profile_id, ordering: {[Op.gt]: row.ordering}}}).catch(catcher);
    await db.materializer.destroy({where: {id: req.query.id}}).catch(catcher);
    const materializers = await db.materializer.findAll({where: {profile_id: row.profile_id}, order: [["ordering", "ASC"]]}).catch(catcher);
    return res.json({id: req.query.id, parent_id: row.profile_id, materializers});
  });

  app.delete("/api/cms/selector/delete", isEnabled, async(req, res) => {
    const row = await db.selector.findOne({where: {id: req.query.id}}).catch(catcher);
    await db.selector.destroy({where: {id: req.query.id}});
    const selectors = await db.selector.findAll({where: {profile_id: row.profile_id}}).catch(catcher);
    return res.json({parent_id: row.profile_id, selectors});
  });

  app.delete("/api/cms/section_selector/delete", isEnabled, async(req, res) => {
    const {selector_id, section_id} = req.query; // eslint-disable-line camelcase
    const row = await db.section_selector.findOne({where: {selector_id, section_id}}).catch(catcher);
    await db.section_selector.update({ordering: sequelize.literal("ordering -1")}, {where: {section_id, ordering: {[Op.gt]: row.ordering}}}).catch(catcher);
    await db.section_selector.destroy({where: {selector_id, section_id}});
    const reqObj = Object.assign({}, sectionReqSectionOnly, {where: {id: row.section_id}});
    let section = await db.section.findOne(reqObj).catch(catcher);
    let rows = [];
    if (section) {
      section = section.toJSON();
      section.selectors = bubbleSortSelectors(db.section_selector, section.selectors);
      rows = section.selectors;
    }
    return res.json({parent_id: row.section_id, selectors: rows});
  });

  app.delete("/api/cms/profile/delete", isEnabled, async(req, res) => {
    const row = await db.profile.findOne({where: {id: req.query.id}}).catch(catcher);
    await db.profile.update({ordering: sequelize.literal("ordering -1")}, {where: {ordering: {[Op.gt]: row.ordering}}}).catch(catcher);
    await db.profile.destroy({where: {id: req.query.id}}).catch(catcher);
    pruneSearch(row.dimension, row.levels, db);
    let profiles = await db.profile.findAll(profileReqFull).catch(catcher);
    profiles = sortProfileTree(db, profiles);
    const sectionTypes = getSectionTypes();
    profiles.forEach(profile => {
      profile.sections = profile.sections.map(section => {
        section = sortSection(db, section);
        section.types = sectionTypes;
        return section;
      });
      return profile;
    });
    return res.json(profiles);
  });

  app.delete("/api/cms/profile_meta/delete", isEnabled, async(req, res) => {
    const row = await db.profile_meta.findOne({where: {id: req.query.id}}).catch(catcher);
    await db.profile_meta.update({ordering: sequelize.literal("ordering -1")}, {where: {ordering: {[Op.gt]: row.ordering}}}).catch(catcher);
    await db.profile_meta.destroy({where: {id: req.query.id}}).catch(catcher);
    pruneSearch(row.dimension, row.levels, db);
    const reqObj = Object.assign({}, profileReqFull, {where: {id: row.profile_id}});
    let newProfile = await db.profile.findOne(reqObj).catch(catcher);
    newProfile = sortProfile(db, newProfile.toJSON());
    const sectionTypes = getSectionTypes();
    newProfile.sections = newProfile.sections.map(section => {
      section = sortSection(db, section);
      section.types = sectionTypes;
      return section;
    });
    return res.json(newProfile);
  });

  app.delete("/api/cms/story/delete", isEnabled, async(req, res) => {
    const row = await db.story.findOne({where: {id: req.query.id}}).catch(catcher);
    await db.story.update({ordering: sequelize.literal("ordering -1")}, {where: {ordering: {[Op.gt]: row.ordering}}}).catch(catcher);
    await db.story.destroy({where: {id: req.query.id}}).catch(catcher);
    let stories = await db.story.findAll(storyReqTreeOnly).catch(catcher);
    stories = sortStoryTree(db, stories);
    return res.json(stories);
  });

  app.delete("/api/cms/formatter/delete", isEnabled, async(req, res) => {
    await db.formatter.destroy({where: {id: req.query.id}}).catch(catcher);
    const rows = await db.formatter.findAll().catch(catcher);
    return res.json(rows);
  });

  app.delete("/api/cms/section/delete", isEnabled, async(req, res) => {
    const row = await db.section.findOne({where: {id: req.query.id}}).catch(catcher);
    await db.section.update({ordering: sequelize.literal("ordering -1")}, {where: {profile_id: row.profile_id, ordering: {[Op.gt]: row.ordering}}}).catch(catcher);
    await db.section.destroy({where: {id: req.query.id}}).catch(catcher);
    let sections = await db.section.findAll({where: {profile_id: row.profile_id}, include: [{association: "content"}], order: [["ordering", "ASC"]]}).catch(catcher);
    sections = sections.map(section => {
      section = section.toJSON();
      section = sortSection(db, section);
      section.types = getSectionTypes();
      return section;
    });
    return res.json({parent_id: row.profile_id, sections});
  });

  app.delete("/api/cms/storysection/delete", isEnabled, async(req, res) => {
    const row = await db.storysection.findOne({where: {id: req.query.id}}).catch(catcher);
    await db.storysection.update({ordering: sequelize.literal("ordering -1")}, {where: {story_id: row.story_id, ordering: {[Op.gt]: row.ordering}}}).catch(catcher);
    await db.storysection.destroy({where: {id: req.query.id}}).catch(catcher);
    const rows = await db.storysection.findAll({
      where: {story_id: row.story_id},
      attributes: ["id", "slug", "ordering", "story_id", "type"],
      include: [
        {association: "content", attributes: ["id", "locale", "title"]}
      ],
      order: [["ordering", "ASC"]]
    }).catch(catcher);
    return res.json(rows);
  });

};
