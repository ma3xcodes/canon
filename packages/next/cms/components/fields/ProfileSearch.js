/* eslint-disable require-jsdoc */
// Todo
// - Keydown events

/* eslint-disable no-case-declarations */
/* eslint-disable no-nested-ternary */
import Link from "next/link.js";
import axios from "axios";

import {unique} from "d3plus-common";
import {
  group, max, merge, min,
} from "d3-array";

// import ProfileColumns from "./ProfileColumns";
import React, {
  useState, useEffect, useRef, useCallback,
} from "react";
import {
  Box, Text, TextInput, Tabs, ScrollArea, SimpleGrid, FocusTrap, Modal, Paper, Flex,
} from "@mantine/core";
import {useDebouncedValue, useHotkeys} from "@mantine/hooks";
import {useRouter} from "next/router.js";
import {IconSearch, IconZoomExclamation} from "@tabler/icons-react";
import ProfileTile from "./ProfileTile";
import groupMeta from "../../utils/groupMeta";
import stripHTML from "../../utils/formatters/stripHTML";
import NonIdealState from "../../../core/components/NonIdealState";

function DimensionFilters({
  activeProfile,
  activeDimensions,
  filterHierarchyTitle,
  filterCubeTitle,
  onFilterLevel,
}) {
  const tabChangeHandler = (value) => {
    const isDimension = activeDimensions.some((d) => {
      const dimensionValue = d.levels ? d.levels.join(",") : d.cubes.join(",");
      return dimensionValue === value;
    });
    if (isDimension) {
      onFilterLevel("all");
    } else {
      onFilterLevel(value);
    }
  };
  return (
    <div>
      <Tabs className="cms-profilesearch-filters-dimensions" onTabChange={tabChangeHandler}>
        {
          activeDimensions.map((d) => {
            const dimensionValue = d.levels ? d.levels.join(",") : d.cubes.join(",");
            const levels = d.sortedLevels
              ? d.sortedLevels : d.sortedCubes;
            const filterTitle = d.sortedLevels ? filterHierarchyTitle : filterCubeTitle;
            return (
              <Tabs.List key={dimensionValue}>
                <Tabs.Tab
                  key={dimensionValue}
                  value={dimensionValue}
                >
                  <Text dangerouslySetInnerHTML={{__html: d.title}} />
                </Tabs.Tab>
                {
                levels.map((l) => (
                  <Tabs.Tab
                    value={l}
                    key={l}
                  >
                    <Text dangerouslySetInnerHTML={{__html: filterTitle(l, activeProfile[0])}} />
                  </Tabs.Tab>
                ))
              }
              </Tabs.List>
            );
          })
}
      </Tabs>
    </div>
  );
}

/** */
function ProfileFilters({
  profiles,
  filters,
  filterProfiles,
  setFilterProfiles,
  filterProfileTitle,
  availableProfiles,
  t,
}) {
  let profileGroups = [];
  if (profiles && filters) {
    const filteredProfiles = (profiles || [])
      .filter((d) => !availableProfiles.length || availableProfiles.includes(d.meta[0].slug));
    profileGroups = Array.from(group(filteredProfiles, (d) => filterProfileTitle(d.content, d.meta)))
      .sort((a, b) => min(a[1], (d) => d.ordering) - min(b[1], (d) => d.ordering));
  }
  if (!profiles || !filters) return null;
  return (

    <Tabs
      className="cms-profilesearch-filters-profiles"
      variant="pills"
      radius="sm"
      my="xs"
      value={filterProfiles}
      onTabChange={setFilterProfiles}
    >
      <Tabs.List position="center">
        <Tabs.Tab value="all">
          <Text dangerouslySetInnerHTML={{__html: filterProfileTitle({label: t("CMS.Search.All")})}} span />
        </Tabs.Tab>
        {
          profileGroups.length > 0
          && profileGroups.map((g) => {
            const profileIds = g[1].map((p) => p.id);
            const value = profileIds.join(",");
            return (
              <Tabs.Tab
                key={value}
                value={value}
              >
                <Text dangerouslySetInnerHTML={{__html: g[0]}} span />
              </Tabs.Tab>

            );
          })
}
      </Tabs.List>
    </Tabs>
  );
}
function useCMSProfiles() {
  const [profiles, setProfiles] = useState(false);
  useEffect(() => {
    const url = new URL("/api/cms/profiles", process.env.NEXT_PUBLIC_CMS).href;
    axios.get(url)
      .then((resp) => resp.data.filter((p) => p.visible))
      .then((profiles) => setProfiles(profiles))
      .catch(() => setProfiles([]));
  }, []);
  return profiles;
}

function useSearchResults({
  query,
  filterLevels,
  filterProfiles,
  filterCubes,
  limit,
  locale,
  showLaterals,
  minQueryLength,
  ignoredTermsRegex,
  formatResults,
  showExamples,
}) {
  const [results, setResults] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!showExamples && !query.length) {
      setResults(false);
      return;
    }

    // Filter ignored terms from user string
    let filteredQuery = query.trim();
    if (query.length < minQueryLength) filteredQuery = "";
    if (ignoredTermsRegex && filteredQuery !== "") {
      filteredQuery = filteredQuery.replace(ignoredTermsRegex, "");
    }

    // Remove multiples spaces with just one -caused by the ignore terms regex and trim it
    filteredQuery = filteredQuery.replace(/\s\s+/g, " ").trim();

    let url = `/api/profilesearch?query=${filteredQuery}&limit=${limit}&locale=${locale}`;
    if (filterProfiles !== "all") url += `&profile=${filterProfiles}`;
    if (filterLevels) url += `&hierarchy=${filterLevels}`;
    if (filterCubes) url += `&cubeName=${filterCubes}`;
    if (showLaterals) url += "&showLaterals=true";

    url = new URL(url, process.env.NEXT_PUBLIC_CMS).href;
    setLoading(url);

    const controller = new AbortController();

    axios.get(url, {
      signal: controller.signal,
    })
      .then(formatResults)
      .then((resp) => {
        if (resp) {
          setResults(resp.data);
          setLoading(false);
        }
      })
      .catch(() => {});

    // eslint-disable-next-line consistent-return
    return () => controller.abort();
  }, [query, filterLevels, filterCubes, filterProfiles, showLaterals, showExamples, limit, locale]);
  return [results, loading];
}
export function ProfileSearch({
  // default props
  // activeKey = false,
  availableProfiles = [],
  filters = false,
  defaultCubes = false,
  defaultLevels = false,
  defaultProfiles = "all",
  filterCubeTitle = (d) => d,
  filterDimensionTitle = (d) => d,
  filterHierarchyTitle = (d) => d,
  filterProfileTitle = (content, meta) => {
    if (content && content.label && content.label !== "New Profile Label") {
      return stripHTML(content.label);
    }
    if (meta && meta.length) {
      const groupedMeta = groupMeta(meta);
      return groupedMeta.length > 0
        ? groupedMeta.map((g) => (g[0] ? g[0].dimension || g[0].slug : "ERR_META")).join(" / ")
        : "Unnamed";
    }
    return "Unnamed";
  },
  // eslint-disable-next-line react/jsx-props-no-spreading
  renderTile = (result, i, tileProps) => <ProfileTile key={`r-${i}`} {...tileProps} data={result} />,
  showExamples = false,
  showLaterals = false,
  subtitleFormat = (d) => d.memberHierarchy,
  titleFormat = (d) => d.name,
  formatResults = (resp) => resp,
  limit = 10,
  minQueryLength = 1,
  columnOrder = [],
  ignoredTerms = [],
  filterQueryArgs = false,
  joiner = " & ",
  placeholder = "Search...",
  renderListItem = (result, i, link, title, subtitle) => (
    <li key={`r-${i}`} className="cms-profilesearch-list-item">
      <Link href={link} className="cms-profilesearch-list-item-link">
        <div>
          {title}
          <div className="cms-profilesearch-list-item-sub u-font-xs">{subtitle}</div>
        </div>
      </Link>
    </li>
  ),
  position = "static",
  display = "list",
  linkify = (profile) => profile.reduce(
    (href, member) => `${href}/${member.slug}/${member.memberSlug || member.id}`,
    "/profile",
  ),
  inputProps = {},
  t,
  footer,
  ...rest
}) {
  const {locale} = useRouter();

  const resultContainer = useRef(null);
  const textInput = useRef(null);

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(false);

  const [filterProfiles, setFilterProfiles] = useState(defaultProfiles);
  const [filterCubes, setFilterCubes] = useState(defaultCubes);
  const [filterLevels, setFilterLevels] = useState(defaultLevels);

  const [debouncedQuery] = useDebouncedValue(query, 400);
  const profiles = useCMSProfiles();

  const ignoredTermsRegex = ignoredTerms && ignoredTerms.length > 0
    ? new RegExp(`\\b(${ignoredTerms.join("|")})\\b`, "ig")
    : false;
  const [results, loading] = useSearchResults({
    query: debouncedQuery,
    filterProfiles,
    filterCubes,
    filterLevels,
    showLaterals,
    showExamples,
    limit,
    locale,
    minQueryLength,
    ignoredTermsRegex,
    filterQueryArgs,
    formatResults,
  });

  let profileGroups = [];
  if (profiles && filters) {
    const filteredProfiles = (profiles || [])
      .filter((d) => !availableProfiles.length || availableProfiles.includes(d.meta[0].slug));
    profileGroups = Array.from(group(filteredProfiles, (d) => filterProfileTitle(d.content, d.meta)))
      .sort((a, b) => min(a[1], (d) => d.ordering) - min(b[1], (d) => d.ordering));
  }
  const activeProfile = profileGroups.find((g) => g[1].map((p) => p.id).join(",") === filterProfiles);

  const onFilterLevel = useCallback((filters) => {
    if (!profiles) return;
    const newFilters = filters !== "all" && filters ? filters.split(",") : [false];

    let newCubes = [];
    let newLevels = [];

    const profileIds = filterProfiles ? filterProfiles.split(",").map(Number) : [];
    const cubeNames = filterCubes ? filterCubes.split(",") : [];
    const levelNames = filterLevels ? filterLevels.split(",") : [];

    const activeMetas = merge(profiles
      .filter((p) => profileIds.includes(p.id))
      .map((p) => p.meta));

    const hierarchyGroups = Array.from(group(
      activeMetas,
      (d) => filterDimensionTitle(d.dimension),
    ), (arr) => [unique(merge(arr[1].map((a) => a.levels))), unique(arr[1].map((a) => a.cubeName))]);

    hierarchyGroups.forEach(([l, c]) => {
      newFilters.forEach((level) => {
        if (c.length > 1) {
          const currCubes = c.find((x) => cubeNames.includes(x));
          if (c.includes(level)) newCubes.push(level);
          else if (level && currCubes) newCubes.push(currCubes);
          else newCubes = newCubes.concat(c);
        } else {
          const currFilter = l.find((x) => levelNames.includes(x));
          if (l.includes(level)) newLevels.push(level);
          else if (level && currFilter) newLevels.push(currFilter);
          else newLevels = newLevels.concat(l);
        }
      });
    });
    setFilterCubes(unique(newCubes).join(","));
    setFilterLevels(unique(newLevels).join(","));
  }, [filterCubes, filterDimensionTitle, filterLevels, filterProfiles, profiles]);

  useEffect(() => onFilterLevel(false), [filterProfiles]);

  let activeDimensions;
  if (activeProfile) {
    const groupedDimensions = group(
      merge(
        activeProfile[1].map((p) => p.meta),
      ),
      (d) => filterDimensionTitle(d.dimension, activeProfile[0]),
    );
    const dimensions = Array.from(groupedDimensions, ([key, value]) => {
      const dimensions = unique(value.map((d) => d.dimension));
      const sortedCubes = Array.from(
        group(
          value.map(
            (d) => d.cubeName,
          ),
          (d) => filterCubeTitle(d, activeProfile[0]),
        ),
        (d) => unique(d[1]).join(","),
      ).sort((a, b) => filterCubeTitle(a, activeProfile[0]).localeCompare(filterCubeTitle(b, activeProfile[0])));
      const cubes = unique(value.map((d) => d.cubeName));
      if (cubes.length > 1) {
        return {
          dimensions, title: key, cubes, sortedCubes,
        };
      }

      const levelSets = value.map((v) => v.levels);
      const levels = unique(merge(levelSets));
      return {
        dimensions,
        title: key,
        levels,
        sortedLevels: levels.slice().sort((a, b) => max(
          levelSets,
          (s) => s.indexOf(a),
        ) - max(levelSets, (s) => s.indexOf(b))),
      };
    });
    activeDimensions = dimensions.filter((d) => (d.levels || d.cubes).length > 1);
  }

  // TODO: enable hotkey events
  // useHotkeys([
  //   ["ArrowLeft", () => console.log("arrow left")],
  //   ["ArrowUp", () => console.log("arrow up")],
  //   ["ArrowRight", () => console.log("arrow right")],
  //   ["ArrowDown", () => console.log("arrow down")]
  // ]);
  return (
    <FocusTrap active>
      <Flex direction="column" className="cms-profilesearch" pos="relative" h="100%" {...rest}>
        <Box>
          <Text
            component="label"
            sx={{
              display: "block", width: 0, height: 0, overflow: "hidden",
            }}
          >
            <Text className="u-visually-hidden" key="slt" span>
              {t("CMS.Search.Search profiles")}
            </Text>
          </Text>
          <TextInput
            ref={textInput}
            className="cp-input"
            icon={<IconSearch />}
            size="xl"
            placeholder={placeholder}
            onFocus={() => setActive(true)}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
            {...inputProps}
          />
          <ProfileFilters
            profiles={profiles}
            filters={filters}
            filterProfiles={filterProfiles}
            setFilterProfiles={setFilterProfiles}
            filterProfileTitle={filterProfileTitle}
            availableProfiles={availableProfiles}
            onFilterLevel={onFilterLevel}
            t={t}
          />
          {
            activeDimensions
            && activeDimensions.length > 0
            && (
            <DimensionFilters
              activeProfile={activeProfile}
              profiles={profiles}
              filters={filters}
              filterCubes={filterCubes}
              filterLevels={filterLevels}
              filterDimensionTitle={filterDimensionTitle}
              setFilterCubes={setFilterCubes}
              setFilterLevels={setFilterLevels}
              activeDimensions={activeDimensions}
              filterCubeTitle={filterCubeTitle}
              filterHierarchyTitle={filterHierarchyTitle}
              onFilterLevel={onFilterLevel}
            />
            )
          }
        </Box>
        <Box
          className={`cms-profilesearch-container cms-profilesearch-container-${position}`}
          key="container"
          pos="relative"
          ref={resultContainer}
          h="100%"
          mt="sm"
          sx={{
            zIndex: 10,
            flexShrink: 1,
            overflow: "hidden",
          }}
        >
          {
            (position !== "absolute" || active) && (results && !loading)
              ? (() => {
                if (!results.grouped.length) {
                  return <NonIdealState height="100%" graphic={<IconZoomExclamation size="2rem" />} message={t("CMS.Search.No results", {query: debouncedQuery})} />;
                }

                switch (display) {
                  case "grid":
                    const gridProfiles = (results.grouped || [])
                      .filter((d) => !availableProfiles.length || availableProfiles.includes(d[0].slug));

                    return (
                      <ScrollArea.Autosize mah="100%" sx={{overflow: "hidden"}}>
                        <SimpleGrid
                          key="grid"
                          breakpoints={[
                            {minWidth: "xs", cols: 1},
                            {minWidth: "sm", cols: 3},
                            {minWidth: "md", cols: 5},
                            {minWidth: "lg", cols: 7},
                          ]}
                          className="cms-profilesearch-grid"
                        >
                          {gridProfiles.map((data, j) => renderTile(data, j, {
                            joiner, subtitleFormat, titleFormat, linkify,
                          }))}
                        </SimpleGrid>
                      </ScrollArea.Autosize>
                    );

                  case "columns":
                    const filteredProfiles = Object.keys(results.profiles || {})
                      .reduce((obj, d) => {
                        let arr = results.profiles[d];
                        if (availableProfiles.length) arr = arr.filter((p) => availableProfiles.includes(p[0].slug));
                        // eslint-disable-next-line no-param-reassign
                        if (arr.length) obj[d] = arr;
                        return obj;
                      }, {});
                    const columnProfiles = Object.keys(filteredProfiles || {})
                      .sort((a, b) => {
                        const aIndex = columnOrder.includes(a) ? columnOrder.indexOf(a) : columnOrder.length + 1;
                        const bIndex = columnOrder.includes(b) ? columnOrder.indexOf(b) : columnOrder.length + 1;
                        return aIndex - bIndex;
                      })
                      .map((profile) => results.profiles[profile] || []);
                    return (
                      null
                      // TODO: ProfileColumns
                      // <ProfileColumns
                      //   columnFormat={subtitleFormat}
                      //   columnTitles={columnTitles}
                      //   joiner={joiner}
                      //   renderTile={renderTile}
                      //   tileProps={{joiner, subtitleFormat, titleFormat}}
                      //   data={columnProfiles}
                      // />
                    );

                  default:
                    // eslint-disable-next-line no-case-declarations
                    const listProfiles = (results.grouped || [])
                      .filter((d) => !availableProfiles.length || availableProfiles.includes(d[0].slug));
                    return (
                      <Paper
                        component="ul"
                        key="list"
                        className="cms-profilesearch-list"
                        pos="absolute"
                        shadow="sm"
                        sx={(theme) => ({
                          listStyleType: "none",
                          padding: "0px !important",
                          left: 0,
                          right: 0,
                          margin: 0,
                          "& li": {
                            padding: theme.spacing.xs,
                            marginTop: 0,
                          },
                          "& li:hover": {
                            background: "rgba(0, 0, 0, .2)",
                            cursor: "pointer",
                          },
                        })}
                      >
                        {listProfiles.map((result, j) => renderListItem(
                          result,
                          j,
                          linkify(result),
                          result.map(titleFormat).join(joiner),
                          result.map(subtitleFormat).join(joiner),
                        ))}
                      </Paper>
                    );
                }
              })()
              : loading && (position !== "absolute" || active)
                ? <NonIdealState height="auto" key="loading" message={t("CMS.Search.Loading")} />
                : position !== "absolute" ? <NonIdealState height="auto" graphic={<IconSearch />} message={t("CMS.Search.Empty")} /> : null
          }
        </Box>
        {footer && <Box>{footer}</Box>}
      </Flex>
    </FocusTrap>
  );
}

export function ProfileSearchModal({modalProps, ...profileSearchProps}) {
  return (
    <Modal
      styles={{
        content: {
          display: "flex",
          flexDirection: "column",
          height: "100%",
        },
        body: {
          maxHeight: "calc(100% - 54px)",
          boxSizing: "border-box",
          flexBasis: "100%",
          flexShrink: 1,
        },
        overlay: {zIndex: 90},
      }}
      {...modalProps}
    >
      <ProfileSearch {...profileSearchProps} />
    </Modal>
  );
}
