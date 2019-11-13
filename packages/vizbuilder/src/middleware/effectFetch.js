import {DimensionType, MultiClient} from "@datawheel/olap-client";
import keyBy from "lodash/keyBy";
import yn from "yn";
import {ensureArray} from "../helpers/arrays";
import {chartCombinationReducer} from "../helpers/chartCombination";
import {findHigherCurrentPeriod} from "../helpers/find";
import {inyectShare, inyectShareByTime} from "../helpers/math";
import {queryBuilder} from "../helpers/query";
import {structCubeBuilder, structMemberBuilder} from "../helpers/structs";
import {datasetToMemberMap} from "../helpers/transform";
import {doChartsUpdate} from "../store/charts/actions";
import {doCubesUpdate} from "../store/cubes/actions";
import {
  selectGeomapLevels,
  selectInstanceParams,
  selectIsGeomapMode
} from "../store/instance/selectors";
import {doPeriodUpdate} from "../store/query/actions";
import {
  selectCube,
  selectQueryParamMeasures,
  selectQueryParamsDrillables
} from "../store/query/selectors";
import {OLAP_FETCHCUBES, OLAP_FETCHMEMBERS, OLAP_RUNQUERY, OLAP_SETUP} from "./actions";

export default {
  /**
   * Setups the datasource URLs on the client.
   *
   * @param {import("../types").MiddlewareActionParams<string | string[]>} param0
   */
  [OLAP_SETUP]: ({action, client}) => {
    const urlList = ensureArray(action.payload);
    return MultiClient.dataSourcesFromURL(...urlList).then(dataSources => {
      // @ts-ignore
      client.datasources = [];
      client.addDataSource(...dataSources);
    });
  },

  /**
   * Retrieves the list of cubes, converts them to CubeItems, and saves them.
   *
   * @param {import("../types").MiddlewareActionParams<undefined>} param0
   */
  [OLAP_FETCHCUBES]: ({client, dispatch, getState}) => {
    const state = getState();
    const isGeomapMode = selectIsGeomapMode(state);
    const geomapLevels = selectGeomapLevels(state);

    /** @type {(cube: import("@datawheel/olap-client").Cube) => boolean} */
    const isGeomapCube = cube =>
      !yn(cube.annotations.hide_in_map) &&
      cube.dimensions.some(dim => {
        if (dim.dimensionType === DimensionType.Geographic) {
          for (let hierarchy, h = 0; (hierarchy = dim.hierarchies[h]); h++) {
            for (let level, l = 0; (level = hierarchy.levels[l]); l++) {
              if (geomapLevels.indexOf(level.name) > -1) {
                return true;
              }
            }
          }
        }
        return false;
      });

    return client.getCubes().then(cubes => {
      const filterFn = isGeomapMode
        ? cube => !yn(cube.annotations.hide_in_ui) || isGeomapCube(cube)
        : cube => !yn(cube.annotations.hide_in_ui);
      const cubeItems = cubes.filter(filterFn).map(structCubeBuilder);
      const cubeMap = keyBy(cubeItems, i => i.uri);
      dispatch(doCubesUpdate(cubeMap));
    });
  },

  /**
   * Retrieves the list of members for a certain level,
   * described by a LevelRef object.
   * This action is intended to return a Promise<Member[]>
   *
   * @param {import("../types").MiddlewareActionParams<LevelRef>} param0
   */
  [OLAP_FETCHMEMBERS]: ({action, client, getState}) => {
    const levelRef = action.payload;
    const state = getState();
    const cube = selectCube(state);

    if (!cube) {
      return Promise.reject(`${OLAP_FETCHMEMBERS}: Measure is not defined.`);
    }

    const levelDescriptor = {
      level: levelRef.level,
      hierarchy: levelRef.hierarchy,
      dimension: levelRef.dimension,
      cube: cube.name,
      server: cube.server
    };
    return client
      .getMembers(levelDescriptor, {locale: "en", ancestors: true})
      .then(memberList => memberList.map(structMemberBuilder));
  },

  /**
   * @param {import("../types").MiddlewareActionParams<undefined>} param0
   */
  [OLAP_RUNQUERY]: ({client, dispatch, getState}) => {
    const state = getState();
    const cube = selectCube(state);
    const {datacap, topojson, visualizations} = selectInstanceParams(state);
    const isGeomapMode = selectIsGeomapMode(state);

    if (!cube) {
      return Promise.reject(`${OLAP_RUNQUERY}: cube is undefined`);
    }

    // collection, filterMeasures, filters, lci, measure, moe, source, uci
    const measureParams = selectQueryParamMeasures(state);
    // levels, groups, timeLevel, geoLevel, cuts, drilldowns
    const drillableParams = selectQueryParamsDrillables(state);

    return client
      .getCube(cube.name)
      .then(cube => {
        const query = queryBuilder(cube.query, measureParams, drillableParams);
        return Promise.all([client.execQuery(query, "aggregate")]);
      })
      .then(aggregations => {
        let selectedPeriod = Number.MIN_SAFE_INTEGER;

        const charts = aggregations
          .map(aggregation => {
            const {measure} = measureParams;
            const {drilldowns, timeLevel, geoLevel} = drillableParams;

            // Get member list from actual data
            const levelCaptions = drilldowns.map(i => i.caption);
            const {countMap, memberMap} = datasetToMemberMap(
              aggregation.data,
              levelCaptions
            );

            let data = aggregation.data;
            let aggregationDatacap = datacap;

            if (measure.aggregationType === "SUM") {
              // Inyect a new calculated measure as share of total by time period
              data = timeLevel
                ? inyectShareByTime(aggregation.data, measure.name, timeLevel.caption)
                : inyectShare(aggregation.data, measure.name);
            }

            if (timeLevel) {
              const timeLevelName = timeLevel.caption;
              aggregationDatacap *= countMap[timeLevelName];
              const maxTimeMember = findHigherCurrentPeriod(memberMap[timeLevelName]);
              selectedPeriod = Math.max(selectedPeriod, maxTimeMember);
            }

            if (data.length > aggregationDatacap) {
              const msg = `This query returned too many data points. Please try a query with less granularity.`;
              throw new Error(msg);
            }

            /** @type {Datagroup} */
            const output = {
              dataset: data,
              hasTopojsonConfig:
                isGeomapMode || Boolean(geoLevel && topojson.includes(geoLevel.caption)),
              memberList: memberMap,
              memberCount: countMap,
              params: {cube, ...measureParams, ...drillableParams},
              visualizations
            };
            return output;
          })
          .reduce(chartCombinationReducer, []);

        if (charts.length === 0) {
          throw new Error(`No data available at that granularity.`);
        }

        // TODO: remove duplicated charts
        // const dedupedCharts = chartCollision(charts);

        dispatch(doPeriodUpdate(selectedPeriod));
        dispatch(doChartsUpdate(charts));
      });
  }
};
