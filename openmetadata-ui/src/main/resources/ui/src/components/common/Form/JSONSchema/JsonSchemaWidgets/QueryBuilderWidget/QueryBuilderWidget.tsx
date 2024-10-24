/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import { InfoCircleOutlined } from '@ant-design/icons';
import { WidgetProps } from '@rjsf/utils';
import { Alert, Button, Card, Col, Row, Skeleton, Typography } from 'antd';
import { t } from 'i18next';
import { debounce, isEmpty, isUndefined } from 'lodash';
import Qs from 'qs';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Builder,
  Config,
  ImmutableTree,
  JsonTree,
  Query,
  Utils as QbUtils,
} from 'react-awesome-query-builder';
import { getExplorePath } from '../../../../../../constants/constants';
import { EntityType } from '../../../../../../enums/entity.enum';
import { SearchIndex } from '../../../../../../enums/search.enum';
import { searchQuery } from '../../../../../../rest/searchAPI';
import { elasticSearchFormat } from '../../../../../../utils/QueryBuilderElasticsearchFormatUtils';
import { getJsonTreeFromQueryFilter } from '../../../../../../utils/QueryBuilderUtils';
import searchClassBase from '../../../../../../utils/SearchClassBase';
import { withAdvanceSearch } from '../../../../../AppRouter/withAdvanceSearch';
import { useAdvanceSearch } from '../../../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.component';
import './query-builder-widget.less';
import { QueryBuilderOutputType } from './QueryBuilderWidget.interface';

const QueryBuilderWidget: FC<WidgetProps> = ({
  onChange,
  schema,
  value,
  ...props
}: WidgetProps) => {
  const { config, treeInternal, onTreeUpdate, onChangeSearchIndex } =
    useAdvanceSearch();
  const [searchResults, setSearchResults] = useState<number | undefined>();
  const [isCountLoading, setIsCountLoading] = useState<boolean>(false);
  const entityType =
    (props.formContext?.entityType ?? schema?.entityType) || EntityType.ALL;
  const searchIndexMapping = searchClassBase.getEntityTypeSearchIndexMapping();
  const searchIndex = searchIndexMapping[entityType as string];
  const outputType = schema?.outputType ?? QueryBuilderOutputType.ELASTICSEARCH;

  const fetchEntityCount = useCallback(
    async (queryFilter: Record<string, unknown>) => {
      try {
        setIsCountLoading(true);
        const res = await searchQuery({
          query: '',
          pageNumber: 0,
          pageSize: 0,
          queryFilter,
          searchIndex: SearchIndex.ALL,
          includeDeleted: false,
          trackTotalHits: true,
          fetchSource: false,
        });
        setSearchResults(res.hits.total.value ?? 0);
      } catch (_) {
        // silent fail
      } finally {
        setIsCountLoading(false);
      }
    },
    []
  );

  const debouncedFetchEntityCount = useMemo(
    () => debounce(fetchEntityCount, 300),
    [fetchEntityCount]
  );

  const queryURL = useMemo(() => {
    const queryFilterString = !isEmpty(treeInternal)
      ? Qs.stringify({ queryFilter: JSON.stringify(treeInternal) })
      : '';

    return `${getExplorePath({})}${queryFilterString}`;
  }, [treeInternal]);

  const showFilteredResourceCount = useMemo(
    () =>
      outputType === QueryBuilderOutputType.ELASTICSEARCH &&
      !isUndefined(value) &&
      searchResults !== undefined &&
      !isCountLoading,
    [outputType, value, isCountLoading]
  );

  const handleChange = (nTree: ImmutableTree, nConfig: Config) => {
    onTreeUpdate(nTree, nConfig);

    if (outputType === QueryBuilderOutputType.ELASTICSEARCH) {
      const data = elasticSearchFormat(nTree, config) ?? {};
      const qFilter = {
        query: data,
      };
      if (data) {
        debouncedFetchEntityCount(qFilter);
      }

      onChange(JSON.stringify(qFilter));
    } else {
      const data = QbUtils.jsonLogicFormat(nTree, config);
      onChange(JSON.stringify(data.logic ?? '{}'));
    }
  };

  useEffect(() => {
    onChangeSearchIndex(searchIndex);
  }, [searchIndex]);

  useEffect(() => {
    if (!isEmpty(value)) {
      if (outputType === QueryBuilderOutputType.ELASTICSEARCH) {
        const tree = QbUtils.checkTree(
          QbUtils.loadTree(
            getJsonTreeFromQueryFilter(JSON.parse(value || '')) as JsonTree
          ),
          config
        );
        onTreeUpdate(tree, config);
      } else {
        const tree = QbUtils.loadFromJsonLogic(JSON.parse(value || ''), config);
        if (tree) {
          onTreeUpdate(tree, config);
        }
      }
    }
  }, []);

  return (
    <div
      className="query-builder-form-field"
      data-testid="query-builder-form-field">
      <Card className="query-builder-card">
        <Row gutter={[8, 8]}>
          <Col className="p-t-sm" span={24}>
            <Query
              {...config}
              renderBuilder={(props) => (
                <div className="query-builder-container query-builder qb-lite">
                  <Builder {...props} />
                </div>
              )}
              value={treeInternal}
              onChange={handleChange}
            />

            {isCountLoading && (
              <Skeleton
                active
                className="m-t-sm"
                loading={isCountLoading}
                paragraph={false}
                title={{ style: { height: '32px' } }}
              />
            )}

            {showFilteredResourceCount && (
              <div className="m-t-sm">
                <Button
                  className="w-full p-0 text-left h-auto"
                  data-testid="view-assets-banner-button"
                  disabled={false}
                  href={queryURL}
                  target="_blank"
                  type="link">
                  <Alert
                    closable
                    showIcon
                    icon={<InfoCircleOutlined height={16} />}
                    message={
                      <div className="d-flex flex-wrap items-center gap-1">
                        <Typography.Text>
                          {t('message.search-entity-count', {
                            count: searchResults,
                          })}
                        </Typography.Text>

                        <Typography.Text className="text-xs text-grey-muted">
                          {t('message.click-here-to-view-assets-on-explore')}
                        </Typography.Text>
                      </div>
                    }
                    type="info"
                  />
                </Button>
              </div>
            )}
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default withAdvanceSearch(QueryBuilderWidget, { isExplorePage: false });
