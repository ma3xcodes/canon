import React from "react";
import PropTypes from "prop-types";
import classnames from "classnames";

import "@blueprintjs/labs/dist/blueprint-labs.css";
import "./index.css";

import LoadingScreen from "components/Loading";
import ChartArea from "./components/ChartArea";
import PermalinkManager from "./components/PermalinkManager";
import Sidebar from "./components/Sidebar";
import Filter from "./components/Sidebar/FilterManager/Filter";
import Ranking from "./components/Sidebar/Ranking";

import {resetClient} from "./helpers/api";
import {chartComponents} from "./helpers/chartHelpers";
import {fetchCubes} from "./helpers/fetch";
import {
  DEFAULT_MEASURE_FORMATTERS,
  DEFAULT_MEASURE_MULTIPLIERS
} from "./helpers/formatting";
import {loadControl, mergeStates, setStatePromise} from "./helpers/loadstate";
import {parsePermalink, permalinkToState} from "./helpers/permalink";
import {getDefaultGroup} from "./helpers/sorting";
import {isSameQuery} from "./helpers/validation";
import initialState from "./state";

class Vizbuilder extends React.PureComponent {
  constructor(props, ctx) {
    super(props);

    let initialStatePromise = this.initialize(props);

    const location = ctx.router.location;
    if (props.permalink && location.search) {
      const permalinkQuery = parsePermalink(this.permalinkKeywords, location);
      initialStatePromise = initialStatePromise.then(
        permalinkToState.bind(null, permalinkQuery)
      );
    }

    this.initialStatePromise = initialStatePromise;

    this.loadControl = loadControl.bind(this);
    this.stateUpdate = this.stateUpdate.bind(this);
    this.getGeneralConfig = this.getGeneralConfig.bind(this);
  }

  initialize(props) {
    this.state = initialState();

    resetClient(props.src);

    Filter.formatters = {...DEFAULT_MEASURE_FORMATTERS, ...props.formatting};
    Filter.multipliers = {...DEFAULT_MEASURE_MULTIPLIERS, ...props.multipliers};

    const defaultGroup = [].concat(props.defaultGroup || []);
    const defaultMeasure = props.defaultMeasure;
    const defaultQuery = {defaultGroup, defaultMeasure};

    this.getDefaultGroup = getDefaultGroup.bind(null, defaultGroup);
    this.permalinkKeywords = {
      enlarged: "enlarged",
      filters: "filters",
      groups: "groups",
      measure: "measure",
      ...props.permalinkKeywords
    };

    return fetchCubes(defaultQuery, props);
  }

  getChildContext() {
    return {
      generalConfig: this.getGeneralConfig(),
      getDefaultGroup: this.getDefaultGroup,
      loadControl: this.loadControl,
      permalinkKeywords: this.permalinkKeywords,
      stateUpdate: this.stateUpdate
    };
  }

  componentDidMount() {
    const initialStatePromise = this.initialStatePromise;
    delete this.initialStatePromise;
    this.loadControl(() => initialStatePromise);
  }

  componentDidUpdate(prevProps, prevState) {
    const {onChange} = this.props;
    const {query} = this.state;

    if (!query.cube) return;

    if (!isSameQuery(prevState.query, query)) {
      onChange(query, this.state.charts);
    }
  }

  render() {
    const {location} = this.context.router;
    const {permalink, toolbar} = this.props;
    const {charts, datagroups, load, options, query} = this.state;

    const chartForRanking = datagroups.filter(ch => !ch.quirk).pop();

    return (
      <div
        className={classnames("vizbuilder", {
          "mapmode": Boolean(options.geomapLevels),
          "fetching": load.inProgress
        })}
      >
        {load.inProgress && <LoadingScreen total={load.total} progress={load.done} />}
        <Sidebar options={options} query={query}>
          {this.props.children}
          <Ranking
            chart={chartForRanking}
            selectedTime={query.selectedTime}
          />
        </Sidebar>
        <ChartArea
          activeChart={query.activeChart}
          charts={charts}
          lastUpdate={load.lastUpdate}
          selectedTime={query.selectedTime}
          toolbar={toolbar}
        />
        {permalink && <PermalinkManager
          activeChart={query.activeChart}
          href={location.search}
          state={this.state}
        />}
      </div>
    );
  }

  getGeneralConfig() {
    const props = this.props;
    return {
      defaultConfig: props.config,
      formatting: {...DEFAULT_MEASURE_FORMATTERS, ...props.formatting},
      multipliers: {...DEFAULT_MEASURE_MULTIPLIERS, ...props.multipliers},
      measureConfig: props.measureConfig,
      topojson: props.topojson,
      visualizations: props.visualizations.filter(viz =>
        chartComponents.hasOwnProperty(viz)
      )
    };
  }

  stateUpdate(newState) {
    return setStatePromise.call(this, state => mergeStates(state, newState));
  }
}

Vizbuilder.contextTypes = {
  router: PropTypes.object
};

Vizbuilder.childContextTypes = {
  generalConfig: PropTypes.object,
  getDefaultGroup: PropTypes.func,
  loadControl: PropTypes.func,
  permalinkKeywords: PropTypes.object,
  stateUpdate: PropTypes.func
};

Vizbuilder.propTypes = {
  config: PropTypes.object,
  datacap: PropTypes.number,
  defaultMeasure: PropTypes.string,
  defaultGroup: PropTypes.arrayOf(PropTypes.string),
  formatting: PropTypes.objectOf(PropTypes.func),
  measureConfig: PropTypes.objectOf(PropTypes.object),
  onChange: PropTypes.func,
  permalink: PropTypes.bool,
  permalinkKeywords: PropTypes.objectOf(PropTypes.string),
  src: PropTypes.string.isRequired,
  toolbar: PropTypes.element,
  topojson: PropTypes.objectOf(
    PropTypes.shape({
      topojson: PropTypes.string.isRequired,
      topojsonId: PropTypes.string,
      topojsonKey: PropTypes.string
    })
  ),
  visualizations: PropTypes.arrayOf(PropTypes.string)
};

Vizbuilder.defaultProps = {
  config: {},
  datacap: 20000,
  formatting: {},
  multipliers: {},
  onChange() {},
  permalink: true,
  topojson: {},
  visualizations: [
    "geomap",
    "treemap",
    "barchart",
    "lineplot",
    "barchartyear",
    "stacked"
  ]
};

export default Vizbuilder;
