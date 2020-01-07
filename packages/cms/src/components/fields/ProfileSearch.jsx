import React, {Component} from "react";
import PropTypes from "prop-types";
import {Link} from "react-router";
import axios from "axios";
import "./ProfileSearch.css";
import linkify from "../../utils/linkify";
import profileTitleFormat from "../../utils/profileTitleFormat";
import ProfileSearchTile from "./ProfileSearchTile";
import {Icon, NonIdealState, Spinner} from "@blueprintjs/core";
import {uuid} from "d3plus-common";
import {titleCase} from "d3plus-text";

/** Creates column titles */
function columnTitle(data) {
  console.log(data[0].map(d => d.slug).join("/"), data[0]);
  return data[0].map(d => {
    let slug = d.slug;
    const dim = d.memberDimension;
    if (data[0].length === 1 && dim.toLowerCase() !== slug.toLowerCase()) {
      if (slug.match(/[A-z]{1,}/g).join("").length < 4) {
        slug = slug.toUpperCase();
      }
      else slug = titleCase(slug);
      return `${dim} (${slug})`;
    }
    return dim;
  }).join("/");
}

class ProfileSearch extends Component {

  constructor(props) {
    super(props);
    this.state = {
      id: uuid(),
      loading: false,
      query: "",
      results: false,
      timeout: 0
    };
  }

  onChange(e) {

    const {timeout} = this.state;
    const {limit, minQueryLength} = this.props;
    const query = e ? e.target.value : this.state.query;
    clearTimeout(timeout);

    if (query.length < minQueryLength) {
      this.setState({results: false, query});
    }
    else {

      const url = `/api/profilesearch?query=${query}&limit=${limit}`;

      // handle the query
      this.setState({
        loading: url,
        // set query separately to avoid input lag
        query,
        results: false,
        // make the request on a timeout
        timeout: setTimeout(() => {

          axios.get(url)
            .then(resp => {
              if (url === this.state.loading) this.setState({results: resp.data, loading: false});
            })
            .catch(() => {});

        }, 500)
      });
    }
  }

  onKeyDown(e) {

    switch(e.keyCode) {
      case 13: // ENTER
        return this.onChange.bind(this)();
      case 27: // ESC
        return this.resetSearch.bind(this)();
    }

  }

  resetSearch(e) {
    this.setState({
      query: "",
      results: false
    });
  }

  render() {

    const {router} = this.context;
    const {loading, query, results} = this.state;
    const {display, inputFontSize, joiner, limit} = this.props;

    console.log(results);

    return (
      <div className="cms-profilesearch">

        <label className={`cp-input-label inputFontSize-${inputFontSize}`}>
          {/* accessibility text */}
          <span className="u-visually-hidden" key="slt">
            Search profiles
          </span>

          {/* the input */}
          <input
            className={`cp-input u-font-${inputFontSize}`}
            placeholder="Search profiles..."
            value={query}
            onChange={this.onChange.bind(this)}
            onKeyDown={this.onKeyDown.bind(this)}
            ref={input => this.textInput = input}
            key="sli"
            type="text"
          />

          {/* search icon (keep after input so it can be easily styled input hover/focus) */}
          <Icon className="cms-profilesearch-icon u-font-xxl" icon="search" key="slii" />

          {/* close button */}
          <button
            className={`cms-profilesearch-reset-button ${query ? "is-visible" : "is-hidden"}`}
            tabIndex={query ? 0 : -1}
            onClick={this.resetSearch.bind(this)}
            key="slb"
          >
            <Icon className="cms-profilesearch-reset-button-icon" icon="cross" />
            <span className="cms-profilesearch-reset-button-text">reset</span>
          </button>
        </label>

        <div className="cms-profilesearch-container">
          {
            results
            ? (() => {

              if (!results.grouped.length) {
                return <NonIdealState icon="zoom-out" title={`No results matching "${query}"`} />;
              }

              switch(display) {

                case "columns":
                  return (
                    <ul className="cms-profilesearch-columns">
                      {Object.keys((results.profiles || {})).map((profile, i) => {
                        const data = (results.profiles[profile] || []).slice(0, limit);
                        return (
                          <li key={`p-${i}`} className="cms-profilesearch-column">
                            <h3 className="cms-profilesearch-column-title">{columnTitle(data)}</h3>
                            <ul className="cms-profilesearch-column-list">
                              {data.map((result, j) =>
                                <ProfileSearchTile key={`r-${j}`} {...this.props} data={result} />)}
                            </ul>
                          </li>
                        );
                      })}
                    </ul>
                  );

                case "list":
                  return (
                    <ul className="cms-profilesearch-list">
                      {(results.grouped || []).slice(0, limit).map((result, j) =>
                        <li key={`r-${j}`} className="cms-profilesearch-list-item">
                          <Link to={linkify(router, result)} className="cms-profilesearch-list-item-link">
                            {result.map(d => profileTitleFormat(d.name)).join(` ${joiner} `)}
                            <div className="cms-profilesearch-list-item-sub u-font-xs">{columnTitle([result])}</div>
                          </Link>
                        </li>
                      )}
                    </ul>
                  );

              }

            })()
            : loading
            ? <NonIdealState icon={<Spinner />} title="Loading results..." />
            : <NonIdealState icon="search" title="Please enter a search term" />
          }
        </div>
      </div>
    );
  }

}

ProfileSearch.contextTypes = {
  router: PropTypes.object
};

ProfileSearch.defaultProps = {
  display: "list",
  inputFontSize: "xxl",
  joiner: "&",
  limit: 10,
  minQueryLength: 1
};

export default ProfileSearch;
