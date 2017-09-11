angular.module("services").service(
    "Domain",
    class Domain {
        /**
         * Constructor
         * @param $rootScope
         * @param $q
         * @param Domains
         * @param DomainValidator
         * @param OvhHttp
         * @param Poll
         * @param Poller
         */
        constructor ($rootScope, $q, Domains, DomainValidator, OvhHttp, Poll, Poller) {
            this.$rootScope = $rootScope;
            this.$q = $q;
            this.Domains = Domains;
            this.DomainValidator = DomainValidator;
            this.OvhHttp = OvhHttp;
            this.Poll = Poll;
            this.Poller = Poller;

            this.cache = {
                domainCache: "UNIVERS_WEB_DOMAIN",
                domainRedirectionCache: "UNIVERS_WEB_DOMAIN_REDIRECTION",
                authInfo: "UNIVERS_WEB_DOMAIN_AUTHINFO"
            };
            this.extensionsChangeOwnerByOrder = ["fr", "be", "eu", "it", "lu", "pro", "lt", "de", "ch"];
        }

        /**
         * Get Selected Domain
         * @param {string} serviceName
         * @param {boolean} forceRefresh
         */
        getSelected (serviceName, forceRefresh = false) {
            return this.OvhHttp.get(`/sws/domain/${serviceName}`, {
                rootPath: "2api",
                cache: this.cache.domainCache,
                clearAllCache: forceRefresh
            });
        }

        /**
         * Get contact fields
         * @param {string} contactId
         */
        getContactFields (contactId) {
            return this.OvhHttp.get(`/me/contact/${contactId}/fields`, {
                rootPath: "apiv6"
            });
        }

        /**
         * Get order service
         * @param {string} serviceName
         */
        getOrderServiceOption (serviceName) {
            return this.OvhHttp.get(`/order/cartServiceOption/domain/${serviceName}`, {
                rootPath: "apiv6"
            });
        }

        /**
         * Get content of summary tabs
         * @param {string} serviceName
         */
        getTabDns (serviceName) {
            return this.OvhHttp.get(`/sws/domain/${serviceName}/dns`, {
                rootPath: "2api"
            });
        }

        /**
         * Get domains
         */
        getDomains (contactId = null) {
            return this.OvhHttp.get("/domain", {
                rootPath: "apiv6",
                params: contactId ? { whoisOwner: contactId } : null
            });
        }

        /**
         * Get domain service infos
         * @param {string} serviceName
         */
        getServiceInfo (serviceName) {
            return this.OvhHttp.get(`/domain/${serviceName}/serviceInfos`, {
                rootPath: "apiv6"
            });
        }

        /**
         * Get task
         * @param {string} serviceName
         * @param {object} params
         */
        getTasks (serviceName, params = {}) {
            return this.OvhHttp.get(`/domain/${serviceName}/task`, {
                rootPath: "apiv6",
                params
            });
        }

        /**
         * Get tasks by status
         * @param {string} serviceName
         * @param {string} fn
         * @param {Array} status
         */
        getTasksByStatus (serviceName, fn, status = []) {
            const promisesTasks = _.map(status, (st) => this.getTasks(serviceName, { status: st, "function": fn }));
            return this.$q.all(promisesTasks).then(_.flatten);
        }

        /**
         * Get task
         * @param {string} serviceName
         * @param {string} id
         */
        getTask (serviceName, id) {
            return this.OvhHttp
                .get(`/domain/${serviceName}/task/${id}`, {
                    rootPath: "apiv6"
                })
                .then((tasksDetails) => {
                    tasksDetails.status = angular.uppercase(tasksDetails.status);
                    return tasksDetails;
                });
        }

        /**
         * Get tasks to poll
         * @param {string} serviceName
         * @param {Array} filters
         * @returns {Promise}
         */
        getTasksToPoll (serviceName, filters) {
            const requests = [];
            const r = [];
            const tasks = [];
            let filteredTask = [];
            const defer = this.$q.defer();

            const doFilter = () => {
                if (filters) {
                    _.forEach(tasks, (task) => {
                        _.forEach(filters, (filter) => {
                            if (task.function === filter) {
                                filteredTask.push(task);
                            }
                        });
                    });
                } else {
                    filteredTask = tasks;
                }

                defer.resolve(filteredTask);
            };

            _.forEach(["todo", "doing"], (status) => {
                r.push(
                    this.OvhHttp
                        .get(`/domain/${serviceName}/task`, {
                            rootPath: "apiv6",
                            params: { status }
                        })
                        .then((response) => {
                            _.forEach(response, (taskId) => {
                                requests.push(
                                    this.OvhHttp.get(`/domain/${serviceName}/task/${taskId}`, { rootPath: "apiv6" }).then((resp) => {
                                        if (resp) {
                                            tasks.push(resp);
                                        }
                                    })
                                );
                            });
                        })
                );
            });

            this.$q.all(r).then(() => {
                this.$q.all(requests).then(doFilter, doFilter);
            });

            return defer.promise;
        }

        /**
        * Restart poll
         * @param {string} serviceName
         * @param {Array} filters
         */
        restartPoll (serviceName, filters) {
            this.getTasksToPoll(serviceName, filters).then((tasks) => {
                _.forEach(tasks, (task) => {
                    this.pollDomainHost({
                        taskId: task.id,
                        taskFunction: task.function,
                        namespace: `domain.${task.function.replace(/\//g, ".")}`
                    });
                });
            });
        }

        /**
         * Poll
         * @param {string} serviceName
         * @param {object} opts
         */
        poll (serviceName, opts) {
            // broadcast start with opts
            this.$rootScope.$broadcast(`domain.${opts.namespace}.start`, opts);

            return this.Poll
                .poll(`apiv6/domain/${serviceName}/task/${opts.taskId}`, null, {
                    namespace: opts.namespace
                })
                .then((resp) => resp);
        }

        // ---------------------DNS NameServer-------------------------

        /**
         * Get All name server
         * @param {string} serviceName
         */
        getAllNameServer (serviceName) {
            return this.OvhHttp
                .get(`/domain/${serviceName}/nameServer`, {
                    rootPath: "apiv6"
                })
                .then((ids) => {
                    if (_.isEmpty(ids)) {
                        const deferred = this.$q.defer();
                        deferred.resolve([]);
                        return deferred.promise;
                    }

                    return this.$q.all(
                        _.map(ids, (id) =>
                            this.OvhHttp.get(`/domain/${serviceName}/nameServer/${id}`, {
                                rootPath: "apiv6"
                            })
                        )
                    );
                });
        }

        /**
        * Get name server status
         * @param {string} serviceName
         * @param {string} id
         */
        getNameServerStatus (serviceName, id) {
            return this.OvhHttp.post(`/domain/${serviceName}/nameServer/${id}/status`, {
                rootPath: "apiv6"
            });
        }

        /**
         * Add DNS Name server
         * @param {string} serviceName
         * @param data
         */
        addDnsNameServer (serviceName, data) {
            if (!data.ip) {
                delete data.ip;
            }
            return this.OvhHttp.post(`/domain/${serviceName}/nameServer`, {
                rootPath: "apiv6",
                data: {
                    nameServer: [data]
                }
            });
        }

        /**
         * Delete DNS name server
         * @param serviceName
         * @param id
         * @returns {*}
         */
        deleteDnsNameServer (serviceName, id) {
            return this.OvhHttp.delete(`/domain/${serviceName}/nameServer/${id}`, {
                rootPath: "apiv6"
            });
        }

        /**
         * Update DNS name server list
         * @param {string} serviceName
         * @param {Array} dnsList
         */
        updateDnsNameServerList (serviceName, dnsList) {
            return this.OvhHttp.post(`/domain/${serviceName}/nameServers/update`, {
                rootPath: "apiv6",
                data: {
                    nameServers: dnsList
                }
            });
        }

        /**
         * Update DNS name server type
         * @param {string} serviceName
         * @param {string} nameServerType
         */
        updateNameServerType (serviceName, nameServerType) {
            return this.OvhHttp.put(`/domain/${serviceName}`, {
                rootPath: "apiv6",
                data: {
                    nameServerType
                }
            });
        }

        /**
         * Change the lock state for the domain
         * @param {string} serviceName
         * @param {string} newLockState
         */
        changeLockState (serviceName, newLockState) {
            return this.OvhHttp.put(`/domain/${serviceName}`, {
                rootPath: "apiv6",
                data: {
                    transferLockStatus: newLockState.toLowerCase()
                },
                broadcast: "domain.dashboard.refresh"
            });
        }

        // ---------------------Zone DNS -------------------------

        /**
         * Activate DNS zone
         * @param {string} serviceName
         * @param {boolean} minimized
         */
        activateZone (serviceName, minimized) {
            return this.OvhHttp.post(`/domain/${serviceName}/activateZone`, {
                rootPath: "apiv6",
                data: {
                    minimized
                },
                broadcast: "domain.tabs.zonedns.refresh"
            });
        }

        /**
         * Reset DNS zone
         * @param {string} serviceName
         * @param {boolean} minimized
         * @param {Array} DnsRecords
         */
        resetZone (serviceName, minimized, DnsRecords) {
            return this.OvhHttp.post(`/domain/zone/${serviceName}/reset`, {
                rootPath: "apiv6",
                data: {
                    minimized,
                    DnsRecords
                },
                broadcast: "domain.tabs.zonedns.refresh"
            });
        }

        /**
         * Delete DNS zone
         * @param serviceName
         */
        deleteAllZone (serviceName) {
            return this.OvhHttp.post(`/domain/zone/${serviceName}/terminate`, {
                rootPath: "apiv6",
                broadcast: "domain.tabs.zonedns.refresh"
            });
        }

        /**
         * Get content of DNS zone tabs
         * @param {string} serviceName
         * @param {number} recordsCount
         * @param {number} offset
         * @param {string,null} search
         * @param {string,null} searchedType
         */
        getTabZoneDns (serviceName, recordsCount = 0, offset = 0, search = undefined, searchedType = undefined) {
            return this.OvhHttp
                .get(`/sws/domain/${serviceName}/zone/records`, {
                    rootPath: "2api",
                    params: {
                        recordsCount,
                        offset,
                        search,
                        searchedType
                    },
                    returnSuccessKey: ""
                })
                .then((_data) => {
                    const data = _data.data;

                    if (data && (!data.messages || (_.isArray(data.messages) && data.messages.length === 0))) {
                        // Generates sanitized targets
                        if (_.get(data, "paginatedZone.records.results", false)) {
                            _.forEach(data.paginatedZone.records.results, (val, key) => {
                                data.paginatedZone.records.results[key].targetToDisplay = this.DomainValidator.convertTargetToUnicode(val.fieldType, val.target);
                            });
                        }
                        return data;
                    }
                    return this.$q.reject(_.get(data, "messages", data));
                });
        }

        /**
         * [proxypass] Get list of records ids
         * @param {string} serviceName
         * @param {object} entry
         */
        getRecordsIds (serviceName, entry) {
            return this.OvhHttp.get(`/domain/zone/${serviceName}/record`, {
                rootPath: "apiv6",
                params: {
                    fieldType: entry ? entry.fieldType : undefined,
                    subDomain: entry ? entry.subDomain : undefined
                }
            });
        }

        /**
         * [proxypass] Get a specific record
         * @param {string} serviceName
         * @param {string} recordId
         */
        getRecord (serviceName, recordId) {
            return this.OvhHttp.get(`/domain/zone/${serviceName}/record/${recordId}`, {
                rootPath: "apiv6"
            });
        }

        /**
         * Add a zone record
         * @param {string} serviceName
         * @param {string} fieldType
         * @param {string} target
         * @param {string} subDomain
         */
        addRecord (serviceName, fieldType, target, subDomain) {
            return this.OvhHttp
                .post(`/domain/zone/${serviceName}/record`, {
                    rootPath: "apiv6",
                    data: {
                        fieldType,
                        target,
                        subDomain,
                        ttl: 60
                    }
                })
                .then(() => this.refreshZoneState(serviceName));
        }

        /**
         * Delete a zone record
         * @param {string} serviceName
         * @param {string} entryId
         */
        deleteRecord (serviceName, entryId) {
            return this.OvhHttp
                .delete(`/domain/zone/${serviceName}/record/${entryId}`, {
                    rootPath: "apiv6"
                })
                .then(() => this.refreshZoneState(serviceName));
        }

        /**
         * Check if record have no brother (Can not have records of this fieldType on this subDomain)
         * @param {string} serviceName
         * @param {string} fieldType
         * @param {string} subDomain
         * @param {string} excludeId
         */
        checkIfRecordHaveNoBrothers (serviceName, fieldType, subDomain, excludeId) {
            return this.getRecordsIds(serviceName, {
                fieldType,
                subDomain: subDomain || ""
            }).then((recordsIds) => _.isEmpty(_.without(recordsIds, excludeId)));
        }

        /**
         * Check if record is unique (Can not have other field of same type of same subDomain with same target)
         * @param {string} serviceName
         * @param {string} fieldType
         * @param {string} subDomain
         * @param {string} excludeId
         * @param {string} target
         */
        checkIfRecordIsUniq (serviceName, fieldType, subDomain, excludeId, target) {
            return this.getRecordsIds(serviceName, {
                fieldType,
                subDomain: subDomain || ""
            }).then((_recordsIds) => {
                let recordsIds = _recordsIds;

                if (_.isEmpty(recordsIds) || _.isEmpty(_.without(recordsIds, excludeId))) {
                    return true;
                }

                recordsIds = _.without(recordsIds, excludeId);

                let found = false;
                const queue = _.map(recordsIds, (id) =>
                    this.OvhHttp
                        .get(`/domain/zone/${serviceName}/record/${id}`, {
                            rootPath: "apiv6"
                        })
                        .then((record) => {
                            if (record && record.target === target && record.subDomain === subDomain) {
                                found = true;
                            }
                        })
                );

                return this.$q.all(queue).then(() => !found);
            });
        }

        /**
         * Checks if a target already exist for this fieldtype + subDomain
         * @param {string} serviceName
         * @param {object} entry
         */
        checkIfRecordCanBeAdd (serviceName, entry) {
            let subDomain;
            if (entry.subDomainToDisplay) {
                subDomain = punycode.toASCII(entry.subDomainToDisplay || "");
            } else {
                subDomain = entry.subDomain;
            }

            switch (entry.fieldType) {

            // Special rule for CNAME:
            // Can not have other CNAME, A, AAAA for this subDomain
            case "CNAME":
                return this.checkIfRecordHaveNoBrothers(serviceName, "CNAME", subDomain, entry.excludeId).then((haveNoBrothers) => {
                    if (!haveNoBrothers) {
                        return false;
                    }
                    return this.checkIfRecordHaveNoBrothers(serviceName, "A", subDomain, entry.excludeId).then((innerHaveNoBrothers) => {
                        if (!innerHaveNoBrothers) {
                            return false;
                        }
                        return this.checkIfRecordHaveNoBrothers(serviceName, "AAAA", subDomain, entry.excludeId).then((innerInnerHaveNoBrothers) => !!innerInnerHaveNoBrothers);
                    });
                });

            // Special rule for A and AAAA:
            // Can not have a CNAME of this subDomain, and can not have other A or AAAA for this subDomain with same target
            case "A":
            case "AAAA":
                return this.checkIfRecordHaveNoBrothers(serviceName, "CNAME", subDomain, entry.excludeId).then((haveNoBrothers) => {
                    if (!haveNoBrothers) {
                        return false;
                    }
                    return this.checkIfRecordIsUniq(serviceName, entry.fieldType, subDomain, entry.excludeId, entry.target).then((isUniq) => isUniq);
                });

            // Other fields:
            // Can not have other field of same type of same subDomain with same target
            default:
                return this.checkIfRecordIsUniq(serviceName, entry.fieldType, subDomain, entry.excludeId, entry.target).then((isUniq) => isUniq);
            }
        }

        /**
         * Delete the DNS entry(ies)
         * @param {string} serviceName
         * @param {string,array} _entryId
         */
        deleteDnsEntry (serviceName, _entryId) {
            let entryId = _entryId;

            if (!_.isArray(entryId)) {
                entryId = [entryId];
            }
            return this.OvhHttp.delete(`/sws/domain/zone/${window.encodeURIComponent(serviceName)}/records`, {
                rootPath: "2api",
                data: { records: entryId },
                clearCache: this.cache.domainCache,
                broadcast: "domain.tabs.zonedns.refresh"
            });
        }

        /**
         * Modify the DNS entry
         * @param {string} serviceName
         * @param {object} entry
         */
        modifyDnsEntry (serviceName, entry) {
            return this.OvhHttp
                .put(`/domain/zone/${serviceName}/record/${entry.id}`, {
                    rootPath: "apiv6",
                    data: {
                        // Warning: when "ToDisplay": Java punyencode the field
                        subDomain: entry.subDomainToDisplay || "",
                        target: entry.target,
                        ttl: entry.ttl !== null && entry.ttl !== "" ? parseInt(entry.ttl, 10) : undefined
                    }
                })
                .then(() => this.refreshZoneState(serviceName));
        }

        /**
         * Add the DNS entry
         * @param {string} serviceName
         * @param {object} entry
         */
        addDnsEntry (serviceName, entry) {
            return this.OvhHttp
                .post(`/domain/zone/${serviceName}/record`, {
                    rootPath: "apiv6",
                    data: {
                        // Warning: when "ToDisplay": Java punyencode the field
                        fieldType: entry.fieldType,
                        subDomain: entry.subDomainToDisplay || undefined,
                        target: entry.target,
                        ttl: entry.ttl != null && entry.ttl !== "" ? parseInt(entry.ttl, 10) : undefined
                    },
                    broadcast: "domain.tabs.zonedns.refresh"
                })
                .then(() => this.refreshZoneState(serviceName));
        }

        /**
         * Order an option for the domain
         * @param {string} serviceName
         * @param {string} option
         * @param {string} duration
         */
        orderOption (serviceName, option, duration) {
            return this.OvhHttp.post(`/order/domain/zone/${serviceName}/${option}/${duration}`, {
                rootPath: "apiv6"
            });
        }

        /**
         * Get details for an option for the domain
         * @param {string} serviceName
         * @param {string} option
         */
        getOptionDetails (serviceName, option) {
            return this.OvhHttp.get(`/sws/domain/${serviceName}/options/${option}`, {
                rootPath: "2api",
                cache: this.cache.domainCache
            });
        }

        /**
         * Get domain redirects
         * @param {string} serviceName
         * @param {object} params
         * @param {boolean} cacheRefresh
         */
        getRedirection (serviceName, params, cacheRefresh) {
            if (params.search === null || params.search === "") {
                delete params.search;
            }
            return this.OvhHttp.get(`/sws/domain/${serviceName}/redirections`, {
                rootPath: "2api",
                params,
                cache: this.cache.domainRedirectionCache,
                clearAllCache: cacheRefresh
            });
        }

        /**
         * Delete domain redirect
         * @param {string} serviceName
         * @param {string} redirectionId
         * @param {boolean} cacheRefresh
         */
        deleteRedirection (serviceName, redirectionId, cacheRefresh = true) {
            return this.OvhHttp
                .delete(`/domain/zone/${serviceName}/redirection/${redirectionId}`, {
                    rootPath: "apiv6",
                    cache: this.cache.domainRedirectionCache,
                    clearAllCache: cacheRefresh
                })
                .then(() => this.refreshZoneState(serviceName));
        }

        /**
         * Check if redirect can be added
         * @param {string} serviceName
         * @param {object} options
         */
        checkRedirectionAdd (serviceName, options) {
            return this.OvhHttp.post(`/sws/domain/${serviceName}/redirections/true/${options.considerWww}`, {
                rootPath: "2api",
                data: options.params
            });
        }

        /**
         * Add a redirect
         * @param {string} serviceName
         * @param {object} options
         */
        addRedirection (serviceName, options) {
            if (options.params.visibilityType === null) {
                options.params.visibilityType = "INVISIBLE";
            }
            return this.OvhHttp.post(`/sws/domain/${serviceName}/redirections/false/${options.considerWww}`, {
                rootPath: "2api",
                data: options.params
            });
        }

        /**
         * Update redirect
         * @param {string} serviceName
         * @param {string} id
         * @param {object} model
         */
        putRedirection (serviceName, id, model) {
            return this.OvhHttp
                .put(`/domain/zone/${serviceName}/redirection/${id}`, {
                    rootPath: "apiv6",
                    data: model
                })
                .then(() => this.refreshZoneState(serviceName));
        }

        /**
         * Update redirect record
         * @param {string} serviceName
         * @param {string} id
         * @param {object} model
         */
        putRedirectionRecord (serviceName, id, model) {
            return this.OvhHttp
                .put(`/domain/zone/${serviceName}/record/${id}`, {
                    rootPath: "apiv6",
                    data: { target: model.targetRedirection }
                })
                .then(() => this.refreshZoneState(serviceName));
        }

        /**
         * Overwrite existing redirects
         * @param {string} serviceName
         * @param {object} options
         * @param {Array} redirectionIds
         */
        overwriteRedirection (serviceName, options, redirectionIds) {
            const createDeletePromises = (ids) => _.map(ids, (id) => this.deleteDnsEntry(serviceName, id));

            if (!_.isEmpty(redirectionIds)) {
                let deletePromises = [];

                _.forEach(redirectionIds, (redirection) => {
                    const APromises = createDeletePromises(redirection.listA);
                    const AAAAPromises = createDeletePromises(redirection.listAAAA);
                    const CNAMEPromises = createDeletePromises(redirection.listCNAME);
                    deletePromises = deletePromises.concat(APromises).concat(AAAAPromises).concat(CNAMEPromises);
                });

                return this.$q.allSettled(deletePromises).finally(() => this.addRedirection(serviceName, options));
            }

            return this.addRedirection(serviceName, options);
        }

        /**
         * Refresh Zone
         * @param {string} serviceName
         * @param {string,null} broadcastId
         */
        refreshZoneState (serviceName, broadcastId = null) {
            return this.OvhHttp.post(`/domain/zone/${serviceName}/refresh`, {
                rootPath: "apiv6",
                broadcast: broadcastId
            });
        }

        /**
         * Get dynHosts
         * @param {string} serviceName
         * @param {object,null} subDomain
         */
        getDynHosts (serviceName, subDomain = null) {
            return this.OvhHttp.get(`/domain/zone/${serviceName}/dynHost/record`, {
                rootPath: "apiv6",
                params: subDomain !== null ? { subDomain: `%${subDomain}%` } : null
            });
        }

        /**
         * Get dynHost
         * @param {string} serviceName
         * @param {string} id
         */
        getDynHost (serviceName, id) {
            return this.OvhHttp.get(`/domain/zone/${serviceName}/dynHost/record/${id}`, {
                rootPath: "apiv6"
            });
        }

        /**
        * Add dynHost
         * @param {string} serviceName
         * @param {object} data
         */
        addDynHost (serviceName, data) {
            return this.OvhHttp.post(`/domain/zone/${serviceName}/dynHost/record/`, {
                rootPath: "apiv6",
                data,
                broadcast: "hosting.tabs.dynHosts.refresh"
            });
        }

        /**
         * Update dynHost
         * @param {string} serviceName
         * @param {string} id
         * @param {object} data
         */
        updateDynHost (serviceName, id, data) {
            return this.OvhHttp.put(`/domain/zone/${serviceName}/dynHost/record/${id}`, {
                rootPath: "apiv6",
                data,
                broadcast: "hosting.tabs.dynHosts.refresh"
            });
        }

        /**
         * Delete DynHost
         * @param {string} serviceName
         * @param {string} id
         */
        deleteDynHost (serviceName, id) {
            return this.OvhHttp.delete(`/domain/zone/${serviceName}/dynHost/record/${id}`, {
                rootPath: "apiv6",
                broadcast: "hosting.tabs.dynHosts.refresh"
            });
        }

        /**
         * Get dynHost login
         * @param {string} serviceName
         * @param {string,null} login
         */
        getDynHostLogin (serviceName, login = null) {
            return this.OvhHttp.get(`/domain/zone/${serviceName}/dynHost/login`, {
                rootPath: "apiv6",
                params: login !== null ? { login: `%${login}%` } : null
            });
        }

        /**
         * Get dynHost login details
         * @param {string} serviceName
         * @param {string} id
         */
        getDynHostLoginDetails (serviceName, id) {
            return this.OvhHttp.get(`/domain/zone/${serviceName}/dynHost/login/${id}`, {
                rootPath: "apiv6"
            });
        }

        /**
         * Add dynHost login
         * @param {string} serviceName
         * @param {object} data
         */
        addDynHostLogin (serviceName, data) {
            return this.OvhHttp.post(`/domain/zone/${serviceName}/dynHost/login`, {
                rootPath: "apiv6",
                data,
                broadcast: "hosting.tabs.dynHostsLogin.refresh"
            });
        }

        /**
         * Update dynHost login
         * @param {string} serviceName
         * @param {string} id
         * @param {object} data
         */
        updateDynHostLogin (serviceName, id, data) {
            return this.OvhHttp.put(`/domain/zone/${serviceName}/dynHost/login/${id}`, {
                rootPath: "apiv6",
                data,
                broadcast: "hosting.tabs.dynHostsLogin.refresh"
            });
        }

        /**
         * Update dynHost login password
         * @param {string} serviceName
         * @param {string} id
         * @param {object} data
         */
        updateDynHostLoginPassword (serviceName, id, data) {
            return this.OvhHttp.post(`/domain/zone/${serviceName}/dynHost/login/${id}/changePassword`, {
                rootPath: "apiv6",
                data,
                broadcast: "hosting.tabs.dynHostsLogin.refresh"
            });
        }

        /**
         * Delete dynHost login
         * @param {string} serviceName
         * @param {string} id
         */
        deleteDynHostLogin (serviceName, id) {
            return this.OvhHttp.delete(`/domain/zone/${serviceName}/dynHost/login/${id}`, {
                rootPath: "apiv6",
                broadcast: "hosting.tabs.dynHostsLogin.refresh"
            });
        }

        /**
         * Get all DNS zones
         */
        getZones () {
            return this.OvhHttp.get("/domain/zone", {
                rootPath: "apiv6"
            });
        }

        /**
         * Get DNS zone by name
         * @param {string} serviceName
         */
        getZoneByZoneName (serviceName) {
            return this.OvhHttp.get(`/domain/zone/${serviceName}`, {
                rootPath: "apiv6"
            });
        }

        /**
         * Get DNS zone tasks
         * @param {string} serviceName
         */
        getZoneDnsTasks (serviceName) {
            return this.OvhHttp.get(`/domain/zone/${serviceName}/task`, {
                rootPath: "apiv6"
            });
        }

        /**
         * Get DNS zone task details
         * @param {string} serviceName
         * @param {string} taskId
         */
        getZoneDnsTask (serviceName, taskId) {
            return this.OvhHttp.get(`/domain/zone/${serviceName}/task/${taskId}`, {
                rootPath: "apiv6"
            });
        }

        /**
         * Get DNS zone SOA
         * @param {string} serviceName
         */
        getZoneSOA (serviceName) {
            return this.OvhHttp.get(`/domain/zone/${serviceName}/soa`, {
                rootPath: "apiv6"
            });
        }

        /**
         * Update DNS zone SOA
         * @param {string} serviceName
         * @param {object} data
         */
        putZoneSOA (serviceName, data) {
            return this.OvhHttp.put(`/domain/zone/${serviceName}/soa`, {
                rootPath: "apiv6",
                data
            });
        }

        /**
         * Get DNS zone status
         * @param {string} serviceName
         */
        getZoneStatus (serviceName) {
            return this.OvhHttp.get(`/domain/zone/${serviceName}/status`, {
                rootPath: "apiv6",
                cache: this.cache.domainCache
            });
        }

        /**
         * Get DNS zone service info
         * @param {string} serviceName
         */
        getZoneServiceInfo (serviceName) {
            return this.OvhHttp.get(`/domain/zone/${serviceName}/serviceInfos`, {
                rootPath: "apiv6"
            });
        }

        /**
         * Get Auth info
         * @param {string} serviceName
         */
        getAuthInfo (serviceName) {
            return this.OvhHttp.get(`/domain/${serviceName}/authInfo`, {
                rootPath: "apiv6",
                cache: this.cache.authInfo
            });
        }

        /**
         * Export DNS config in text mode
         * @param {string} serviceName
         */
        exportDnsText (serviceName) {
            return this.OvhHttp.get(`/domain/zone/${serviceName}/export`, {
                rootPath: "apiv6"
            });
        }

        /**
         * Import DNS config in text mode
         * @param {string} serviceName
         * @param {object} data
         */
        importDnsText (serviceName, data) {
            return this.OvhHttp.post(`/domain/zone/${serviceName}/import`, {
                rootPath: "apiv6",
                data
            });
        }

        /**
         * Poll DnsSec
         * @param {string} serviceName
         * @param {boolean} enabling
         */
        pollDnsSec (serviceName, enabling) {
            return this.Poll
                .poll(`apiv6/domain/zone/${serviceName}/dnssec`, null, {
                    namespace: "dnssec.get",
                    successRule: { status: enabling ? "enabled" : "disabled" }
                })
                .then((response) => {
                    this.$rootScope.$broadcast("dnssec.get.done", response);
                    return response;
                }); // error = just stop polling
        }

        /**
         * Poll Transfer Lock
         * @param {string} serviceName
         * @param {boolean} locking
         */
        pollTransfertLock (serviceName, locking) {
            return this.Poll
                .poll(`apiv6/domain/${serviceName}`, null, {
                    namespace: "transfertLock.get",
                    successRule: { transferLockStatus: locking ? "locked" : "unlocked" }
                })
                .then((response) => {
                    this.$rootScope.$broadcast("transfertLock.get.done", response);
                    return response.data;
                });
        }

        /**
         * Kill all domain polls
         */
        killDomainPolling () {
            _.forEach(["dnssec.get", "transfertLock.get"], (action) => {
                this.Poll.kill({ namespace: action });
            });
        }

        /**
         * Get all domain operations
         * @param {object} data
         */
        getOperations (data) {
            return this.OvhHttp.get("/me/task/domain", {
                rootPath: "apiv6",
                data
            });
        }

        /**
         * Get domain pending tasks
         * @param {string} serviceName
         * @param {object} data
         */
        getDomainPendingTasks (serviceName, data) {
            return this.OvhHttp.get(`/domain/${serviceName}/task`, {
                rootPath: "apiv6",
                data
            });
        }

        /**
         * Get domains models
         */
        getDomainModels () {
            return this.OvhHttp.get("/domain.json", {
                rootPath: "apiv6"
            });
        }

        // --------------------- Glue registry ----------------------

        /**
         * Get Glue records
         * @param {string} serviceName
         */
        getGlueRecords (serviceName) {
            return this.OvhHttp.get(`/domain/${serviceName}/glueRecord`, {
                rootPath: "apiv6"
            });
        }

        /**
         * Get Glue record details
         * @param {string} serviceName
         * @param {string} host
         */
        getGlueRecordDetail (serviceName, host) {
            return this.OvhHttp.get(`/domain/${serviceName}/glueRecord/${host}`, {
                rootPath: "apiv6"
            });
        }

        /**
         * Add Glue record
         * @param {string} serviceName
         * @param {object} data
         */
        addGlueRecord (serviceName, data) {
            return this.OvhHttp
                .post(`/domain/${serviceName}/glueRecord`, {
                    rootPath: "apiv6",
                    data
                })
                .then((task) => {
                    if (task) {
                        this.pollDomainHost(serviceName, {
                            taskId: task.id,
                            taskFunction: task.function
                        });
                    }
                    return task;
                });
        }

        /**
         * Delete Glue record
         * @param {string} serviceName
         * @param {string} host
         */
        deleteGlueRecord (serviceName, host) {
            return this.OvhHttp
                .delete(`/domain/${serviceName}/glueRecord/${host}`, {
                    rootPath: "apiv6"
                })
                .then((task) => {
                    if (task) {
                        this.pollDomainHost(serviceName, {
                            taskId: task.id,
                            taskFunction: task.function
                        });
                    }
                    return task;
                });
        }

        /**
         * Update Glue record
         * @param {string} serviceName
         * @param {string} host
         * @param {object} data
         */
        editGlueRecord (serviceName, host, data) {
            return this.OvhHttp
                .post(`/domain/${serviceName}/glueRecord/${host}/update`, {
                    rootPath: "apiv6",
                    data: _.omit(data, "host")
                })
                .then((task) => {
                    if (task) {
                        this.pollDomainHost(serviceName, {
                            taskId: task.id,
                            taskFunction: task.function
                        });
                    }
                    return task;
                });
        }

        /**
         * Domain host poll
         * @param {string} serviceName
         * @param {object} opts
         */
        pollDomainHost (serviceName, opts) {
            const namespace = `domain.${opts.taskFunction}`;
            const options = angular.copy(opts);
            options.namespace = namespace;

            return this.poll(serviceName, {
                taskId: opts.taskId,
                namespace
            })
                .then(() => {
                    this.$rootScope.$broadcast(`${namespace}.done`, options);
                })
                .catch((err) => {
                    this.$rootScope.$broadcast(`${namespace}.error`, options);
                    return this.$q.reject(err);
                });
        }

        /**
         * Kill domain host creating poll
         */
        killPollDomainHostCreate () {
            this.Poll.kill({ namespace: "domain.DomainHostCreate" });
        }

        /**
         * Kill domain host deleting poll
         */
        killPollDomainHostDelete () {
            this.Poll.kill({ namespace: "domain.DomainHostDelete" });
        }

        /**
         * Kill domain host updating poll
         */
        killPollDomainHostUpdate () {
            this.Poll.kill({ namespace: "domain.DomainHostUpdate" });
        }

        // --------------------- DNSSec ----------------------

        /**
     * Get DNSSec by id
         * @param {string} serviceName
         * @param {string} id
         */
        getDnssec (serviceName, id) {
            return this.OvhHttp.get(`/domain/${serviceName}/dsRecord/${id}`, {
                rootPath: "apiv6"
            });
        }

        /**
         * Fetch list of DNSSec id's for the specified domain
         * @param {string} serviceName
         */
        getDnssecList (serviceName) {
            return this.OvhHttp.get(`/domain/${serviceName}/dsRecord`, {
                rootPath: "apiv6"
            });
        }

        /**
         * Save DNSSEC array
         * @param {string} serviceName
         * @param {object} data
         */
        saveDnssecList (serviceName, data) {
            return this.OvhHttp.post(`/domain/${serviceName}/dsRecord`, {
                rootPath: "apiv6",
                data
            });
        }

        // --------------------- UK tags ----------------------

        /**
         * Tags UK
         * @param {string} serviceName
         * @param {object} data
         */
        postTagsUk (serviceName, data) {
            return this.OvhHttp.post(`/domain/${serviceName}/ukOutgoingTransfer`, {
                rootPath: "apiv6",
                data
            });
        }

        //----------------------------------------------------

        /**
         * Get DNSSec status
         * @param serviceName
         */
        getDnssecStatus (serviceName) {
            return this.OvhHttp.get(`/domain/zone/${serviceName}/dnssec`, {
                rootPath: "apiv6"
            });
        }

        /**
         *
         * @param {string} serviceName
         */
        getOwoFields (serviceName) {
            return this.OvhHttp.get(`/domain/${serviceName}/owo`, {
                rootPath: "apiv6"
            });
        }

        /**
         * Get Owner
         * @param {string} serviceName
         */
        getOwner (serviceName) {
            return this.OvhHttp
                .get(`/domain/${serviceName}`, { rootPath: "apiv6" })
                .then((response) => {
                    if (response.whoisOwner && !isNaN(parseInt(response.whoisOwner, 10))) {
                        return this.OvhHttp
                            .get(`/me/contact/${response.whoisOwner}`, { rootPath: "apiv6" })
                            .then((responseOwner) => {
                                const dataToReturn = angular.copy(responseOwner);
                                dataToReturn.contactId = response.whoisOwner;
                                return dataToReturn;
                            })
                            .catch((err) => this.$q.reject(err));
                    }
                    return null;
                })
                .catch((err) => this.$q.reject(err));
        }

        /**
         * Get domain details
         * @param {string} serviceName
         * @param {Array} options
         */
        getDetails (serviceName, options) {
            const queue = [];
            const catchErrorAndGoOn = () => {
                const deferred = this.$q.defer();
                deferred.resolve(null);
                return deferred.promise;
            };

            queue.push(this.getServiceInfo(serviceName));

            if (_.indexOf(options, "dnssec") !== -1) {
                queue.push(this.getDnssecStatus(serviceName).catch(catchErrorAndGoOn));
            } else {
                queue.push(null);
            }

            if (_.indexOf(options, "owo") !== -1) {
                queue.push(this.getOwoFields(serviceName).catch(catchErrorAndGoOn));
            } else {
                queue.push(null);
            }

            if (_.indexOf(options, "owner") !== -1) {
                queue.push(this.getOwner(serviceName).catch(catchErrorAndGoOn));
            } else {
                queue.push(null);
            }

            if (_.indexOf(options, "dns") !== -1) {
                queue.push(this.getAllNameServer(serviceName));
            } else {
                queue.push(null);
            }

            return this.$q
                .all(queue)
                .then((results) => {
                    const data = results[0] || {};
                    data.dnssec = results[1];
                    data.owo = results[2];
                    data.owner = results[3];
                    data.dns = results[4];

                    if (!_.isEmpty(data.domain) && _.isString(data.domain)) {
                        data.displayName = punycode.toUnicode(data.domain);
                    } else {
                        data.displayName = null;
                    }

                    return data;
                })
                .catch(catchErrorAndGoOn);
        }
    }
);
