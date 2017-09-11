angular
    .module("App")
    .controller("DomainTabDynHostCtrl", class DomainTabDynHostCtrl {
        constructor ($scope, $q, $stateParams, Alerter, Domain, Products) {
            this.$scope = $scope;
            this.$q = $q;
            this.$stateParams = $stateParams;
            this.Alerter = Alerter;
            this.Domain = Domain;
            this.Products = Products;
        }

        $onInit () {
            this.currentView = "dynHostView";
            this.currentViewData = null;

            this.domainHasZone = false;
            this.hasResult = false;
            this.loading = {
                init: false,
                dynHosts: false
            };
            this.product = null;
            this.search = { subDomain: "" };

            this.$scope.$on("hosting.tabs.dynHosts.refresh", () => {
                this.loading.init = true;
                this.hasResult = false;
                this.refreshTableDynHosts();
            });

            this.initialLoad();
        }

        initialLoad () {
            this.loading.init = true;
            this.zones = [];

            return this.$q
                .all({
                    zones: this.Domain.getZones(),
                    product: this.Products.getSelectedProduct()
                })
                .then(({ zones, product }) => {
                    this.zones = zones;
                    this.product = product;
                    this.domainHasZone = _.includes(zones, product.name);

                    if (this.domainHasZone) {
                        this.refreshTableDynHosts();
                    }
                })
                .catch((err) => {
                    this.displayError(err, "domain_tab_DYNHOST_error");
                })
                .finally(() => {
                    this.loading.init = false;
                });
        }

        displayError (err, trKey) {
            if (err.status === 460 && err.data && /service(\s|\s\w+\s)expired/i.test(err.data.message)) {
                // If the service is really expired, the customers have already received several messages
                return;
            }
            this.Alerter.alertFromSWS(this.$scope.tr(trKey), err.data || err, this.$scope.alerts.dashboard);
        }

        //---------------------------------------------
        // Navigation
        //---------------------------------------------

        selectSubView (view, data) {
            this.currentView = view;
            this.currentViewData = data || null;
        }

        resetInitialView () {
            this.currentView = "dynHostView";
            this.currentViewData = null;
        }

        //---------------------------------------------
        // Search
        //---------------------------------------------

        emptySearch () {
            this.search.subDomain = "";
            this.refreshTableDynHosts();
        }

        //---------------------------------------------
        // DynHosts
        //---------------------------------------------
        refreshTableDynHosts () {
            this.loading.dynHosts = true;
            this.dynHosts = null;
            const subDomain = this.search.subDomain ? punycode.toASCII(this.search.subDomain) : null;

            return this.Domain
                .getDynHosts(this.product.name, subDomain)
                .then((data) => {
                    this.dynHosts = data;
                    if (!_.isEmpty(this.dynHosts.length)) {
                        this.hasResult = true;
                    }
                })
                .catch((err) => this.displayError(err, "domain_tab_DYNHOST_error"))
                .finally(() => {
                    if (_.isEmpty(this.dynHosts)) {
                        this.loading.dynHosts = false;
                    }
                });
        }

        transformItem (item) {
            return this.Domain.getDynHost(this.product.name, item).then(this.constructor.subDomainToPunycode, (err) => err);
        }

        onTransformItemDone () {
            this.loading.dynHosts = false;
        }

        static subDomainToPunycode (item) {
            _.set(item, "subDomain", punycode.toUnicode(item.subDomain));
            return item;
        }
    }
);
