# API coverage

The bundled client mirrors all 222 operations in the checked-in official Hetzner API snapshots: 190 Cloud operations and 32 Hetzner Storage Box operations.
Each row corresponds to one client operation. Inputs use `path`, `query`, and `body` groups with the original API field names and request schemas.

Cloud resources include servers, server types, volumes, primary and floating IPs, firewalls, networks, load balancers, load balancer types, images, ISOs, SSH keys, certificates, placement groups, DNS zones and RRSets, locations, pricing, and actions.
The Hetzner API additionally covers Storage Boxes, types, folders, snapshots, subaccounts, and their actions.

Robot dedicated-server management and S3 Object Storage are separate APIs and are outside these two official specifications.

Deprecated endpoints are retained for a complete specification mirror. In particular, `GET /datacenters` and `GET /datacenters/{id}` were removed on 2026-10-01; use locations and location-specific resource data instead.

| Client operation | Method | Path | Summary | Status |
| --- | --- | --- | --- | --- |
| `cloud_add_load_balancer_service` | POST | `/load_balancers/{id}/actions/add_service` | Add Service | Current |
| `cloud_add_load_balancer_target` | POST | `/load_balancers/{id}/actions/add_target` | Add Target | Current |
| `cloud_add_network_route` | POST | `/networks/{id}/actions/add_route` | Add a route to a Network | Current |
| `cloud_add_network_subnet` | POST | `/networks/{id}/actions/add_subnet` | Add a subnet to a Network | Current |
| `cloud_add_server_to_placement_group` | POST | `/servers/{id}/actions/add_to_placement_group` | Add a Server to a Placement Group | Current |
| `cloud_add_zone_rrset_records` | POST | `/zones/{id_or_name}/rrsets/{rr_name}/{rr_type}/actions/add_records` | Add Records to an RRSet | Current |
| `cloud_apply_firewall_to_resources` | POST | `/firewalls/{id}/actions/apply_to_resources` | Apply to Resources | Current |
| `cloud_assign_floating_ip` | POST | `/floating_ips/{id}/actions/assign` | Assign a Floating IP to a Server | Current |
| `cloud_assign_primary_ip` | POST | `/primary_ips/{id}/actions/assign` | Assign a Primary IP to a resource | Current |
| `cloud_attach_load_balancer_to_network` | POST | `/load_balancers/{id}/actions/attach_to_network` | Attach a Load Balancer to a Network | Current |
| `cloud_attach_server_iso` | POST | `/servers/{id}/actions/attach_iso` | Attach an ISO to a Server | Current |
| `cloud_attach_server_to_network` | POST | `/servers/{id}/actions/attach_to_network` | Attach a Server to a Network | Current |
| `cloud_attach_volume` | POST | `/volumes/{id}/actions/attach` | Attach Volume to a Resource | Current |
| `cloud_change_floating_ip_dns_ptr` | POST | `/floating_ips/{id}/actions/change_dns_ptr` | Change reverse DNS records for a Floating IP | Current |
| `cloud_change_floating_ip_protection` | POST | `/floating_ips/{id}/actions/change_protection` | Change Floating IP Protection | Current |
| `cloud_change_image_protection` | POST | `/images/{id}/actions/change_protection` | Change Image Protection | Current |
| `cloud_change_load_balancer_algorithm` | POST | `/load_balancers/{id}/actions/change_algorithm` | Change Algorithm | Current |
| `cloud_change_load_balancer_dns_ptr` | POST | `/load_balancers/{id}/actions/change_dns_ptr` | Change reverse DNS entry for this Load Balancer | Current |
| `cloud_change_load_balancer_protection` | POST | `/load_balancers/{id}/actions/change_protection` | Change Load Balancer Protection | Current |
| `cloud_change_load_balancer_type` | POST | `/load_balancers/{id}/actions/change_type` | Change the Type of a Load Balancer | Current |
| `cloud_change_network_ip_range` | POST | `/networks/{id}/actions/change_ip_range` | Change IP range of a Network | Current |
| `cloud_change_network_protection` | POST | `/networks/{id}/actions/change_protection` | Change Network Protection | Current |
| `cloud_change_primary_ip_dns_ptr` | POST | `/primary_ips/{id}/actions/change_dns_ptr` | Change reverse DNS records for a Primary IP | Current |
| `cloud_change_primary_ip_protection` | POST | `/primary_ips/{id}/actions/change_protection` | Change Primary IP Protection | Current |
| `cloud_change_server_alias_ips` | POST | `/servers/{id}/actions/change_alias_ips` | Change alias IPs of a Network | Current |
| `cloud_change_server_dns_ptr` | POST | `/servers/{id}/actions/change_dns_ptr` | Change reverse DNS entry for this Server | Current |
| `cloud_change_server_protection` | POST | `/servers/{id}/actions/change_protection` | Change Server Protection | Current |
| `cloud_change_server_type` | POST | `/servers/{id}/actions/change_type` | Change the Type of a Server | Current |
| `cloud_change_volume_protection` | POST | `/volumes/{id}/actions/change_protection` | Change Volume Protection | Current |
| `cloud_change_zone_primary_nameservers` | POST | `/zones/{id_or_name}/actions/change_primary_nameservers` | Change a Zone's Primary Nameservers | Current |
| `cloud_change_zone_protection` | POST | `/zones/{id_or_name}/actions/change_protection` | Change a Zone's Protection | Current |
| `cloud_change_zone_rrset_protection` | POST | `/zones/{id_or_name}/rrsets/{rr_name}/{rr_type}/actions/change_protection` | Change an RRSet's Protection | Current |
| `cloud_change_zone_rrset_ttl` | POST | `/zones/{id_or_name}/rrsets/{rr_name}/{rr_type}/actions/change_ttl` | Change an RRSet's TTL | Current |
| `cloud_change_zone_ttl` | POST | `/zones/{id_or_name}/actions/change_ttl` | Change a Zone's Default TTL | Current |
| `cloud_create_certificate` | POST | `/certificates` | Create a Certificate | Current |
| `cloud_create_firewall` | POST | `/firewalls` | Create a Firewall | Current |
| `cloud_create_floating_ip` | POST | `/floating_ips` | Create a Floating IP | Current |
| `cloud_create_load_balancer` | POST | `/load_balancers` | Create a Load Balancer | Current |
| `cloud_create_network` | POST | `/networks` | Create a Network | Current |
| `cloud_create_placement_group` | POST | `/placement_groups` | Create a PlacementGroup | Current |
| `cloud_create_primary_ip` | POST | `/primary_ips` | Create a Primary IP | Current |
| `cloud_create_server` | POST | `/servers` | Create a Server | Current |
| `cloud_create_server_image` | POST | `/servers/{id}/actions/create_image` | Create Image from a Server | Current |
| `cloud_create_ssh_key` | POST | `/ssh_keys` | Create an SSH key | Current |
| `cloud_create_volume` | POST | `/volumes` | Create a Volume | Current |
| `cloud_create_zone` | POST | `/zones` | Create a Zone | Current |
| `cloud_create_zone_rrset` | POST | `/zones/{id_or_name}/rrsets` | Create an RRSet | Current |
| `cloud_delete_certificate` | DELETE | `/certificates/{id}` | Delete a Certificate | Current |
| `cloud_delete_firewall` | DELETE | `/firewalls/{id}` | Delete a Firewall | Current |
| `cloud_delete_floating_ip` | DELETE | `/floating_ips/{id}` | Delete a Floating IP | Current |
| `cloud_delete_image` | DELETE | `/images/{id}` | Delete an Image | Current |
| `cloud_delete_load_balancer` | DELETE | `/load_balancers/{id}` | Delete a Load Balancer | Current |
| `cloud_delete_load_balancer_service` | POST | `/load_balancers/{id}/actions/delete_service` | Delete Service | Current |
| `cloud_delete_network` | DELETE | `/networks/{id}` | Delete a Network | Current |
| `cloud_delete_network_route` | POST | `/networks/{id}/actions/delete_route` | Delete a route from a Network | Current |
| `cloud_delete_network_subnet` | POST | `/networks/{id}/actions/delete_subnet` | Delete a subnet from a Network | Current |
| `cloud_delete_placement_group` | DELETE | `/placement_groups/{id}` | Delete a PlacementGroup | Current |
| `cloud_delete_primary_ip` | DELETE | `/primary_ips/{id}` | Delete a Primary IP | Current |
| `cloud_delete_server` | DELETE | `/servers/{id}` | Delete a Server | Current |
| `cloud_delete_ssh_key` | DELETE | `/ssh_keys/{id}` | Delete an SSH key | Current |
| `cloud_delete_volume` | DELETE | `/volumes/{id}` | Delete a Volume | Current |
| `cloud_delete_zone` | DELETE | `/zones/{id_or_name}` | Delete a Zone | Current |
| `cloud_delete_zone_rrset` | DELETE | `/zones/{id_or_name}/rrsets/{rr_name}/{rr_type}` | Delete an RRSet | Current |
| `cloud_detach_load_balancer_from_network` | POST | `/load_balancers/{id}/actions/detach_from_network` | Detach a Load Balancer from a Network | Current |
| `cloud_detach_server_from_network` | POST | `/servers/{id}/actions/detach_from_network` | Detach a Server from a Network | Current |
| `cloud_detach_server_iso` | POST | `/servers/{id}/actions/detach_iso` | Detach an ISO from a Server | Current |
| `cloud_detach_volume` | POST | `/volumes/{id}/actions/detach` | Detach Volume | Current |
| `cloud_disable_load_balancer_public_interface` | POST | `/load_balancers/{id}/actions/disable_public_interface` | Disable the public interface of a Load Balancer | Current |
| `cloud_disable_server_backup` | POST | `/servers/{id}/actions/disable_backup` | Disable Backups for a Server | Current |
| `cloud_disable_server_rescue` | POST | `/servers/{id}/actions/disable_rescue` | Disable Rescue Mode for a Server | Current |
| `cloud_enable_load_balancer_public_interface` | POST | `/load_balancers/{id}/actions/enable_public_interface` | Enable the public interface of a Load Balancer | Current |
| `cloud_enable_server_backup` | POST | `/servers/{id}/actions/enable_backup` | Enable and Configure Backups for a Server | Current |
| `cloud_enable_server_rescue` | POST | `/servers/{id}/actions/enable_rescue` | Enable Rescue Mode for a Server | Current |
| `cloud_get_action` | GET | `/actions/{id}` | Get an Action | Current |
| `cloud_get_actions` | GET | `/actions` | Get multiple Actions | Current |
| `cloud_get_certificate` | GET | `/certificates/{id}` | Get a Certificate | Current |
| `cloud_get_certificate_action` | GET | `/certificates/{id}/actions/{action_id}` | Get an Action for a Certificate | Deprecated |
| `cloud_get_certificates_action` | GET | `/certificates/actions/{id}` | Get an Action | Current |
| `cloud_get_datacenter` | GET | `/datacenters/{id}` | Get a Data Center | Deprecated |
| `cloud_get_firewall` | GET | `/firewalls/{id}` | Get a Firewall | Current |
| `cloud_get_firewall_action` | GET | `/firewalls/{id}/actions/{action_id}` | Get an Action for a Firewall | Deprecated |
| `cloud_get_firewalls_action` | GET | `/firewalls/actions/{id}` | Get an Action | Current |
| `cloud_get_floating_ip` | GET | `/floating_ips/{id}` | Get a Floating IP | Current |
| `cloud_get_floating_ip_action` | GET | `/floating_ips/{id}/actions/{action_id}` | Get an Action for a Floating IP | Deprecated |
| `cloud_get_floating_ips_action` | GET | `/floating_ips/actions/{id}` | Get an Action | Current |
| `cloud_get_image` | GET | `/images/{id}` | Get an Image | Current |
| `cloud_get_image_action` | GET | `/images/{id}/actions/{action_id}` | Get an Action for an Image | Deprecated |
| `cloud_get_images_action` | GET | `/images/actions/{id}` | Get an Action | Current |
| `cloud_get_iso` | GET | `/isos/{id}` | Get an ISO | Current |
| `cloud_get_load_balancer` | GET | `/load_balancers/{id}` | Get a Load Balancer | Current |
| `cloud_get_load_balancer_action` | GET | `/load_balancers/{id}/actions/{action_id}` | Get an Action for a Load Balancer | Deprecated |
| `cloud_get_load_balancer_metrics` | GET | `/load_balancers/{id}/metrics` | Get Metrics for a LoadBalancer | Current |
| `cloud_get_load_balancer_type` | GET | `/load_balancer_types/{id}` | Get a Load Balancer Type | Current |
| `cloud_get_load_balancers_action` | GET | `/load_balancers/actions/{id}` | Get an Action | Current |
| `cloud_get_location` | GET | `/locations/{id}` | Get a Location | Current |
| `cloud_get_network` | GET | `/networks/{id}` | Get a Network | Current |
| `cloud_get_network_action` | GET | `/networks/{id}/actions/{action_id}` | Get an Action for a Network | Deprecated |
| `cloud_get_networks_action` | GET | `/networks/actions/{id}` | Get an Action | Current |
| `cloud_get_placement_group` | GET | `/placement_groups/{id}` | Get a PlacementGroup | Current |
| `cloud_get_pricing` | GET | `/pricing` | Get all prices | Current |
| `cloud_get_primary_ip` | GET | `/primary_ips/{id}` | Get a Primary IP | Current |
| `cloud_get_primary_ip_action` | GET | `/primary_ips/{id}/actions/{action_id}` | Get an Action for a Primary IP | Deprecated |
| `cloud_get_primary_ips_action` | GET | `/primary_ips/actions/{id}` | Get an Action | Current |
| `cloud_get_server` | GET | `/servers/{id}` | Get a Server | Current |
| `cloud_get_server_action` | GET | `/servers/{id}/actions/{action_id}` | Get an Action for a Server | Deprecated |
| `cloud_get_server_metrics` | GET | `/servers/{id}/metrics` | Get Metrics for a Server | Current |
| `cloud_get_server_type` | GET | `/server_types/{id}` | Get a Server Type | Current |
| `cloud_get_servers_action` | GET | `/servers/actions/{id}` | Get an Action | Current |
| `cloud_get_ssh_key` | GET | `/ssh_keys/{id}` | Get a SSH key | Current |
| `cloud_get_volume` | GET | `/volumes/{id}` | Get a Volume | Current |
| `cloud_get_volume_action` | GET | `/volumes/{id}/actions/{action_id}` | Get an Action for a Volume | Deprecated |
| `cloud_get_volumes_action` | GET | `/volumes/actions/{id}` | Get an Action | Current |
| `cloud_get_zone` | GET | `/zones/{id_or_name}` | Get a Zone | Current |
| `cloud_get_zone_action` | GET | `/zones/{id_or_name}/actions/{action_id}` | Get an Action for a Zone | Deprecated |
| `cloud_get_zone_rrset` | GET | `/zones/{id_or_name}/rrsets/{rr_name}/{rr_type}` | Get an RRSet | Current |
| `cloud_get_zone_zonefile` | GET | `/zones/{id_or_name}/zonefile` | Export a Zone file | Current |
| `cloud_get_zones_action` | GET | `/zones/actions/{id}` | Get an Action | Current |
| `cloud_import_zone_zonefile` | POST | `/zones/{id_or_name}/actions/import_zonefile` | Import a Zone file | Current |
| `cloud_list_certificate_actions` | GET | `/certificates/{id}/actions` | List Actions for a Certificate | Current |
| `cloud_list_certificates` | GET | `/certificates` | List Certificates | Current |
| `cloud_list_certificates_actions` | GET | `/certificates/actions` | List Actions | Current |
| `cloud_list_datacenters` | GET | `/datacenters` | List Data Centers | Deprecated |
| `cloud_list_firewall_actions` | GET | `/firewalls/{id}/actions` | List Actions for a Firewall | Current |
| `cloud_list_firewalls` | GET | `/firewalls` | List Firewalls | Current |
| `cloud_list_firewalls_actions` | GET | `/firewalls/actions` | List Actions | Current |
| `cloud_list_floating_ip_actions` | GET | `/floating_ips/{id}/actions` | List Actions for a Floating IP | Current |
| `cloud_list_floating_ips` | GET | `/floating_ips` | List Floating IPs | Current |
| `cloud_list_floating_ips_actions` | GET | `/floating_ips/actions` | List Actions | Current |
| `cloud_list_image_actions` | GET | `/images/{id}/actions` | List Actions for an Image | Current |
| `cloud_list_images` | GET | `/images` | List Images | Current |
| `cloud_list_images_actions` | GET | `/images/actions` | List Actions | Current |
| `cloud_list_isos` | GET | `/isos` | List ISOs | Current |
| `cloud_list_load_balancer_actions` | GET | `/load_balancers/{id}/actions` | List Actions for a Load Balancer | Current |
| `cloud_list_load_balancer_types` | GET | `/load_balancer_types` | List Load Balancer Types | Current |
| `cloud_list_load_balancers` | GET | `/load_balancers` | List Load Balancers | Current |
| `cloud_list_load_balancers_actions` | GET | `/load_balancers/actions` | List Actions | Current |
| `cloud_list_locations` | GET | `/locations` | List Locations | Current |
| `cloud_list_network_actions` | GET | `/networks/{id}/actions` | List Actions for a Network | Current |
| `cloud_list_network_members` | GET | `/networks/{id}/members` | List Members of a Network | Current |
| `cloud_list_networks` | GET | `/networks` | List Networks | Current |
| `cloud_list_networks_actions` | GET | `/networks/actions` | List Actions | Current |
| `cloud_list_placement_groups` | GET | `/placement_groups` | List Placement Groups | Current |
| `cloud_list_primary_ip_actions` | GET | `/primary_ips/{id}/actions` | List Actions for a Primary IP | Current |
| `cloud_list_primary_ips` | GET | `/primary_ips` | List Primary IPs | Current |
| `cloud_list_primary_ips_actions` | GET | `/primary_ips/actions` | List Actions | Current |
| `cloud_list_server_actions` | GET | `/servers/{id}/actions` | List Actions for a Server | Current |
| `cloud_list_server_types` | GET | `/server_types` | List Server Types | Current |
| `cloud_list_servers` | GET | `/servers` | List Servers | Current |
| `cloud_list_servers_actions` | GET | `/servers/actions` | List Actions | Current |
| `cloud_list_ssh_keys` | GET | `/ssh_keys` | List SSH keys | Current |
| `cloud_list_volume_actions` | GET | `/volumes/{id}/actions` | List Actions for a Volume | Current |
| `cloud_list_volumes` | GET | `/volumes` | List Volumes | Current |
| `cloud_list_volumes_actions` | GET | `/volumes/actions` | List Actions | Current |
| `cloud_list_zone_actions` | GET | `/zones/{id_or_name}/actions` | List Actions for a Zone | Current |
| `cloud_list_zone_rrsets` | GET | `/zones/{id_or_name}/rrsets` | List RRSets | Current |
| `cloud_list_zones` | GET | `/zones` | List Zones | Current |
| `cloud_list_zones_actions` | GET | `/zones/actions` | List Actions | Current |
| `cloud_poweroff_server` | POST | `/servers/{id}/actions/poweroff` | Power off a Server | Current |
| `cloud_poweron_server` | POST | `/servers/{id}/actions/poweron` | Power on a Server | Current |
| `cloud_reboot_server` | POST | `/servers/{id}/actions/reboot` | Soft-reboot a Server | Current |
| `cloud_rebuild_server` | POST | `/servers/{id}/actions/rebuild` | Rebuild a Server from an Image | Current |
| `cloud_remove_firewall_from_resources` | POST | `/firewalls/{id}/actions/remove_from_resources` | Remove from Resources | Current |
| `cloud_remove_load_balancer_target` | POST | `/load_balancers/{id}/actions/remove_target` | Remove Target | Current |
| `cloud_remove_server_from_placement_group` | POST | `/servers/{id}/actions/remove_from_placement_group` | Remove from Placement Group | Current |
| `cloud_remove_zone_rrset_records` | POST | `/zones/{id_or_name}/rrsets/{rr_name}/{rr_type}/actions/remove_records` | Remove Records from an RRSet | Current |
| `cloud_request_server_console` | POST | `/servers/{id}/actions/request_console` | Request Console for a Server | Current |
| `cloud_reset_server` | POST | `/servers/{id}/actions/reset` | Reset a Server | Current |
| `cloud_reset_server_password` | POST | `/servers/{id}/actions/reset_password` | Reset root Password of a Server | Current |
| `cloud_resize_volume` | POST | `/volumes/{id}/actions/resize` | Resize Volume | Current |
| `cloud_retry_certificate` | POST | `/certificates/{id}/actions/retry` | Retry Issuance or Renewal | Current |
| `cloud_set_firewall_rules` | POST | `/firewalls/{id}/actions/set_rules` | Set Rules | Current |
| `cloud_set_zone_rrset_records` | POST | `/zones/{id_or_name}/rrsets/{rr_name}/{rr_type}/actions/set_records` | Set Records of an RRSet | Current |
| `cloud_shutdown_server` | POST | `/servers/{id}/actions/shutdown` | Shutdown a Server | Current |
| `cloud_unassign_floating_ip` | POST | `/floating_ips/{id}/actions/unassign` | Unassign a Floating IP | Current |
| `cloud_unassign_primary_ip` | POST | `/primary_ips/{id}/actions/unassign` | Unassign a Primary IP from a resource | Current |
| `cloud_update_certificate` | PUT | `/certificates/{id}` | Update a Certificate | Current |
| `cloud_update_firewall` | PUT | `/firewalls/{id}` | Update a Firewall | Current |
| `cloud_update_floating_ip` | PUT | `/floating_ips/{id}` | Update a Floating IP | Current |
| `cloud_update_image` | PUT | `/images/{id}` | Update an Image | Current |
| `cloud_update_load_balancer` | PUT | `/load_balancers/{id}` | Update a Load Balancer | Current |
| `cloud_update_load_balancer_service` | POST | `/load_balancers/{id}/actions/update_service` | Update Service | Current |
| `cloud_update_network` | PUT | `/networks/{id}` | Update a Network | Current |
| `cloud_update_placement_group` | PUT | `/placement_groups/{id}` | Update a PlacementGroup | Current |
| `cloud_update_primary_ip` | PUT | `/primary_ips/{id}` | Update a Primary IP | Current |
| `cloud_update_server` | PUT | `/servers/{id}` | Update a Server | Current |
| `cloud_update_ssh_key` | PUT | `/ssh_keys/{id}` | Update an SSH key | Current |
| `cloud_update_volume` | PUT | `/volumes/{id}` | Update a Volume | Current |
| `cloud_update_zone` | PUT | `/zones/{id_or_name}` | Update a Zone | Current |
| `cloud_update_zone_rrset` | PUT | `/zones/{id_or_name}/rrsets/{rr_name}/{rr_type}` | Update an RRSet | Current |
| `cloud_update_zone_rrset_records` | POST | `/zones/{id_or_name}/rrsets/{rr_name}/{rr_type}/actions/update_records` | Update Records of an RRSet | Current |
| `hetzner_change_storage_box_protection` | POST | `/storage_boxes/{id}/actions/change_protection` | Change Protection | Current |
| `hetzner_change_storage_box_subaccount_home_directory` | POST | `/storage_boxes/{id}/subaccounts/{subaccount_id}/actions/change_home_directory` | Change Home Directory | Current |
| `hetzner_change_storage_box_type` | POST | `/storage_boxes/{id}/actions/change_type` | Change Type | Current |
| `hetzner_create_storage_box` | POST | `/storage_boxes` | Create a Storage Box | Current |
| `hetzner_create_storage_box_snapshot` | POST | `/storage_boxes/{id}/snapshots` | Create a Snapshot | Current |
| `hetzner_create_storage_box_subaccount` | POST | `/storage_boxes/{id}/subaccounts` | Create a Subaccount | Current |
| `hetzner_delete_storage_box` | DELETE | `/storage_boxes/{id}` | Delete a Storage Box | Current |
| `hetzner_delete_storage_box_snapshot` | DELETE | `/storage_boxes/{id}/snapshots/{snapshot_id}` | Delete a Snapshot | Current |
| `hetzner_delete_storage_box_subaccount` | DELETE | `/storage_boxes/{id}/subaccounts/{subaccount_id}` | Delete a Subaccount | Current |
| `hetzner_disable_storage_box_snapshot_plan` | POST | `/storage_boxes/{id}/actions/disable_snapshot_plan` | Disable Snapshot Plan | Current |
| `hetzner_enable_storage_box_snapshot_plan` | POST | `/storage_boxes/{id}/actions/enable_snapshot_plan` | Enable Snapshot Plan | Current |
| `hetzner_get_storage_box` | GET | `/storage_boxes/{id}` | Get a Storage Box | Current |
| `hetzner_get_storage_box_action` | GET | `/storage_boxes/{id}/actions/{action_id}` | Get an Action for a Storage Box | Deprecated |
| `hetzner_get_storage_box_snapshot` | GET | `/storage_boxes/{id}/snapshots/{snapshot_id}` | Get a Snapshot | Current |
| `hetzner_get_storage_box_subaccount` | GET | `/storage_boxes/{id}/subaccounts/{subaccount_id}` | Get a Subaccount | Current |
| `hetzner_get_storage_box_type` | GET | `/storage_box_types/{id}` | Get a Storage Box Type | Current |
| `hetzner_get_storage_boxes_action` | GET | `/storage_boxes/actions/{id}` | Get an Action | Current |
| `hetzner_list_storage_box_actions` | GET | `/storage_boxes/{id}/actions` | List Actions for a Storage Box | Current |
| `hetzner_list_storage_box_folders` | GET | `/storage_boxes/{id}/folders` | List folders of a Storage Box | Current |
| `hetzner_list_storage_box_snapshots` | GET | `/storage_boxes/{id}/snapshots` | List Snapshots | Current |
| `hetzner_list_storage_box_subaccounts` | GET | `/storage_boxes/{id}/subaccounts` | List Subaccounts | Current |
| `hetzner_list_storage_box_types` | GET | `/storage_box_types` | List Storage Box Types | Current |
| `hetzner_list_storage_boxes` | GET | `/storage_boxes` | List Storage Boxes | Current |
| `hetzner_list_storage_boxes_actions` | GET | `/storage_boxes/actions` | List Actions | Current |
| `hetzner_reset_storage_box_password` | POST | `/storage_boxes/{id}/actions/reset_password` | Reset Password | Current |
| `hetzner_reset_storage_box_subaccount_password` | POST | `/storage_boxes/{id}/subaccounts/{subaccount_id}/actions/reset_subaccount_password` | Reset Password | Current |
| `hetzner_rollback_storage_box_snapshot` | POST | `/storage_boxes/{id}/actions/rollback_snapshot` | Rollback Snapshot | Current |
| `hetzner_update_storage_box` | PUT | `/storage_boxes/{id}` | Update a Storage Box | Current |
| `hetzner_update_storage_box_access_settings` | POST | `/storage_boxes/{id}/actions/update_access_settings` | Update Access Settings | Current |
| `hetzner_update_storage_box_snapshot` | PUT | `/storage_boxes/{id}/snapshots/{snapshot_id}` | Update a Snapshot | Current |
| `hetzner_update_storage_box_subaccount` | PUT | `/storage_boxes/{id}/subaccounts/{subaccount_id}` | Update a Subaccount | Current |
| `hetzner_update_storage_box_subaccount_access_settings` | POST | `/storage_boxes/{id}/subaccounts/{subaccount_id}/actions/update_access_settings` | Update Access Settings | Current |
