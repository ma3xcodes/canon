import axios from "axios";
import React, {Component} from "react";
import Search from "../Search/Search.jsx";
import {Button} from "@blueprintjs/core";
import "./DimensionCard.css";

export default class DimensionCard extends Component {

  constructor(props) {
    super(props);
    this.state = {
    };
  }

  componentDidMount() {
  }

  onSelectPreview(result) {
    // todo bivariate - should this slug come from preview or meta? once the user
    // is able to change slug, one of these will have to become the source of truth
    const {slug} = this.props.preview;
    const {id} = result;
    if (this.props.onSelectPreview) this.props.onSelectPreview(slug, id);
  }

  rebuildSearch() {
    const {meta} = this.props;
    const url = "/api/cms/repopulateSearch";

    const payload = {
    };

  }

  render() {
    const {meta, preview} = this.props;

    if (!preview) return null;

    return (
      <div className="cms-card cms-dimension-card">
        <table className="cms-dimension-card-table">
          <tr className="cms-dimension-card-table-row">
            <th className="cms-dimension-card-table-cell">slug</th>
            <th className="cms-dimension-card-table-cell">Dimension</th>
            <th className="cms-dimension-card-table-cell">Levels</th>
            <th className="cms-dimension-card-table-cell">Measure</th>
            <th className="cms-dimension-card-table-cell">Preview ID</th>
          </tr>
          <tr className="cms-dimension-card-table-row">
            <td className="cms-dimension-card-table-cell">{meta.slug}</td>
            <td className="cms-dimension-card-table-cell">{meta.dimension}</td>
            <td className="cms-dimension-card-table-cell">
              {meta.levels.length === 1
                ? meta.levels
                : <ul className="cms-dimension-card-table-list">
                  {meta.levels.map(level =>
                    <li className="cms-dimension-card-table-item" key={level}>{level}</li>
                  )}
                </ul>
              }
            </td>
            <td className="cms-dimension-card-table-cell">{meta.measure}</td>
            <td className="cms-dimension-card-table-cell">{preview.id}</td>
          </tr>
        </table>
        <div className="dimension-card-controls">
          <label>
            Preview profile
            <Search
              render={d => <span onClick={this.onSelectPreview.bind(this, d)}>{d.name}</span>}
              dimension={meta.dimension}
              levels={meta.levels}
              limit={20}
            />
          </label>
          <button className="cms-button" onClick={this.rebuildSearch.bind(this)}>
            Rebuild
          </button>
        </div>
      </div>
    );
  }

}
