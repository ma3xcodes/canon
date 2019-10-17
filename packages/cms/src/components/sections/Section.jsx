import React, {Component, Fragment} from "react";
import PropTypes from "prop-types";
import {connect} from "react-redux";
import {nest} from "d3-collection";
import {AnchorLink} from "@datawheel/canon-core";

import styles from "style.yml";
import isIE from "../../utils/isIE.js";
import throttle from "../../utils/throttle";
import pxToInt from "../../utils/formatters/pxToInt";
import toKebabCase from "../../utils/formatters/toKebabCase";

import SourceGroup from "../Viz/SourceGroup";
import StatGroup from "../Viz/StatGroup";

import Parse from "./components/Parse";
import Selector from "./components/Selector";

import Default from "./Default";
import Grouping from "./Grouping";
import InfoCard from "./InfoCard";
import MultiColumn from "./MultiColumn";
import SingleColumn from "./SingleColumn";
import Tabs from "./Tabs";

// used to construct component
// NOTE: should be every Component in `components/sections/` except for Section (i.e., this component) and Hero (always rendered separately)
const sectionTypes = {Default, Grouping, InfoCard, MultiColumn, SingleColumn, Tabs};

/** wrapper for all sections */
class Section extends Component {

  constructor(props) {
    super(props);
    this.state = {
      contents: props.contents,
      loading: false,
      isStickyIE: false,
      selectors: {},
      sources: [],
      // Snapshots of the variables that have been changed by onSetVariables
      // So we can reset these and only these to their original values.
      changedVariables: {}
    };

    // used for IE sticky fallback
    this.section = React.createRef();
    this.scrollBind = this.handleScroll.bind(this);
  }

  componentDidMount() {
    const stickySection = this.state.contents.position === "sticky";
    const currentSection = this.section.current;

    // make sure the section is sticky
    if (stickySection === true && typeof window !== "undefined") {
      window.addEventListener("scroll", this.scrollBind);
      this.setState({
        // combine the position
        top: currentSection.getBoundingClientRect().top + document.documentElement.scrollTop,
        height: currentSection.getBoundingClientRect().height
      });
    }
  }

  componentWillUnmount() {
    window.removeEventListener("scroll", this.scrollBind);
  }

  componentDidUpdate(prevProps) {
    if (JSON.stringify(prevProps.contents) !== JSON.stringify(this.props.contents)) {
      this.setState({contents: this.props.contents});
      this.updateSource.bind(this)(false);
    }
  }

  updateSource(newSources) {
    if (!newSources) this.setState({sources: []});
    else {
      const {sources} = this.state;
      newSources
        .map(s => s.annotations)
        .forEach(source => {
          if (source.source_name && !sources.find(s => s.source_name === source.source_name)) sources.push(source);
        });
      this.setState({sources});
    }
  }

  getChildContext() {
    const {formatters, variables} = this.context;
    return {
      formatters,
      variables: this.props.variables || variables,
      onSetVariables: this.onSetVariables.bind(this)
    };
  }

  /**
   * Sections has received an onSetVariables function from props. However, this Section needs to 
   * keep track locally of what it has changed, so that when a "reset" button is clicked, it can set
   * the variables back to their original state. This local intermediary function, passed down via context,
   * is responsible for keeping track of that, then in turn calling the props version of the function.
   */
  onSetVariables(newVariables) {
    const initialVariables = this.context.initialVariables || {};
    const changedVariables = {};
    Object.keys(newVariables).forEach(key => {
      changedVariables[key] = initialVariables[key];
    });
    this.setState({changedVariables});
    if (this.props.onSetVariables) this.props.onSetVariables(newVariables);
  }

  /**
   * When the user clicks reset, take the snapshot of the variables they changed and use them to 
   * revert only those variables via the props function. 
   */ 
  resetVariables() {
    const {changedVariables} = this.state;
    if (this.props.onSetVariables) this.props.onSetVariables(changedVariables);
    this.setState({changedVariables: {}});
  }

  handleScroll() {
    const stickySection = this.state.contents.position === "sticky";

    // make sure the current section is sticky & the document window exists
    if (stickySection === true && isIE) {
      const isStickyIE = this.state.isStickyIE;
      const containerTop = this.state.top;
      const screenTop = document.documentElement.scrollTop + pxToInt(styles["sticky-section-offset"] || "50px");

      throttle(() => {
        if (screenTop !== containerTop) {
          if (containerTop < screenTop && !isStickyIE) {
            this.setState({isStickyIE: true});
          }
          else if (containerTop > screenTop && isStickyIE) {
            this.setState({isStickyIE: false});
          }
        }
      });
    }
  }

  render() {
    const {contents, sources, isStickyIE, height, changedVariables} = this.state;
    const {headingLevel, loading, isModal} = this.props;

    // remap old section names
    const layout = contents.type;
    const layoutClass = `cp-${toKebabCase(layout)}-section`;

    const Layout = contents.position === "sticky" ? Default : sectionTypes[layout] || Default; // assign the section layout component

    const {descriptions, slug, stats, subtitles, title, visualizations} = contents;
    const selectors = contents.selectors || [];

    // heading & subhead(s)
    const mainTitle = <Fragment>
      {title &&
        <div className={`cp-section-heading-wrapper ${layoutClass}-heading-wrapper`}>
          <Parse El={headingLevel} id={slug} className={`cp-section-heading ${layoutClass}-heading${layout !== "Hero" && !isModal ? " cp-section-anchored-heading" : ""}`} tabIndex="0">
            {title}
          </Parse>
          {!isModal &&
            <AnchorLink to={slug} className={`cp-section-heading-anchor ${layoutClass}-heading-anchor`}>
              #<span className="u-visually-hidden">permalink to section</span>
            </AnchorLink>
          }
        </div>
      }
    </Fragment>;

    const subTitle = <React.Fragment>
      {contents.position !== "sticky" && subtitles.map((content, i) =>
        <Parse className={`cp-section-subhead display ${layoutClass}-subhead`} key={`${content.subtitle}-subhead-${i}`}>
          {content.subtitle}
        </Parse>
      )}
    </React.Fragment>;

    const heading = <Fragment>
      {mainTitle}
      {subTitle}
    </Fragment>;

    // filters
    const filters = selectors.map(selector =>
      <Selector
        key={selector.id}
        {...selector}
        loading={loading}
        fontSize="xxs"
      />
    );

    // stats
    let statContent, secondaryStatContent;

    if (contents.position !== "sticky") {
      const statGroups = nest().key(d => d.title).entries(stats);

      if (stats.length > 0) {
        statContent = <div className="cp-stat-group-wrapper">
          <div className="cp-stat-group">
            {statGroups.map(({key, values}, i) => !(layout === "InfoCard" && i > 0) // only push the first stat for cards
              ? <StatGroup key={key} title={key} stats={values} /> : ""
            )}
          </div>
        </div>;
      }
      if (stats.length > 1 && layout === "InfoCard") {
        secondaryStatContent = <div className="cp-stat-group-wrapper cp-secondary-stat-group-wrapper">
          <div className="cp-stat-group">
            {statGroups.map(({key, values}, i) => i > 0 // don't push the first stat again
              ? <StatGroup key={key} title={key} stats={values} /> : ""
            )}
          </div>
        </div>;
      }
    }

    // paragraphs
    let paragraphs;
    if (descriptions.length && contents.position !== "sticky") {
      paragraphs = loading
        ? <p>Loading...</p>
        : descriptions.map((content, i) =>
          <Parse className={`cp-section-paragraph ${layoutClass}-paragraph`} key={`${content.description}-paragraph-${i}`}>
            {content.description}
          </Parse>
        );
    }

    // sources
    const sourceContent = <SourceGroup sources={sources} />;

    const showReset = Object.keys(changedVariables).length > 0;

    const componentProps = {
      slug,
      title,
      heading,
      mainTitle,
      subTitle,
      filters,
      stats: statContent,
      secondaryStats: secondaryStatContent,
      sources: sourceContent,
      paragraphs: layout === "Tabs" ? contents.descriptions : paragraphs,
      visualizations: contents.position !== "sticky" ? visualizations : [],
      vizHeadingLevel: `h${parseInt(headingLevel.replace("h", ""), 10) + 1}`,
      loading
    };

    return (
      <Fragment>
        <section
          className={`cp-section cp-${toKebabCase(contents.type)}-section${
            contents.position === "sticky" ? " is-sticky" : ""
          }${
            isStickyIE ? " ie-is-stuck" : ""
          }${
            isModal ? " cp-modal-section" : ""
          }`}
          ref={this.section}
          key={`section-${contents.id}`}
        >
          <Layout {...componentProps} />
          {showReset && <button onClick={this.resetVariables.bind(this)}>Reset</button>} 
        </section>

        {/* in IE, create empty div set to the height of the stuck element */}
        {isStickyIE ? <Fragment>
          <div className="ie-sticky-spacer" style={{height}} />
          <div className="ie-sticky-section-color-fixer" />
        </Fragment> : ""}
      </Fragment>
    );
  }
}

Section.defaultProps = {
  headingLevel: "h2"
};

Section.contextTypes = {
  formatters: PropTypes.object,
  router: PropTypes.object,
  variables: PropTypes.object,
  initialVariables: PropTypes.object
};

Section.childContextTypes = {
  formatters: PropTypes.object,
  variables: PropTypes.object,
  onSetVariables: PropTypes.func
};

export default connect(state => ({
  locale: state.i18n.locale
}))(Section);
